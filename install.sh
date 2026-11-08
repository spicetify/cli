#!/usr/bin/env sh
# Copyright 2022 khanhas.
# Copyright 2023-present Spicetify contributors.
# Edited from project Denoland install script (https://github.com/denoland/deno_install)

set -e

for arg in "$@"; do
    shift
    case "$arg" in
        "--root") override_root=1 ;;
        *)
        if echo "$arg" | grep -qv "^-"; then
            tag="$arg"
        else
            echo "Invalid option $arg" >&2
            exit 1
        fi
    esac
done

is_root() {
    [ "$(id -u)" -ne 0 ]
}

if ! is_root && [ "${override_root:-0}" -eq 0 ]; then
    echo "The script was ran under sudo or as root. The script will now exit"
    echo "If you hadn't intended to do this, please execute the script without root access to avoid problems with spicetify"
    echo "To override this behavior, pass the '--root' parameter to this script"
    exit
fi

spicetify_install="$HOME/.spicetify"
exe="$spicetify_install/spicetify"
installed_exe=
if [ -x "$exe" ]; then
    installed_exe="$exe"
elif command -v spicetify >/dev/null 2>&1; then
    installed_exe=$(command -v spicetify)
fi

if [ -n "$installed_exe" ]; then
    echo "Spicetify is already installed. Do you want to fix your installation? (Y/n)"
    read -r choice < /dev/tty
    if [ "$choice" != "N" ] && [ "$choice" != "n" ]; then
        "$installed_exe" update
        exit 0
    fi
fi

# wipe existing log
> install.log :

log() {
    echo "$1"
    echo "[$(date +'%H:%M:%S %Y-%m-%d')]" "$1" >> install.log
}

# print the body of the github api response for url $1.
# on a network error or a non-200 status, log the status and github's message, then fail.
gh_api() {
    response=$(curl -sSL -w '\n%{http_code}' "$1") || { log "Cannot reach $1" >&2; return 1; }
    status=$(printf '%s\n' "$response" | tail -n 1)
    response=$(printf '%s\n' "$response" | sed '$d')
    if [ "$status" != 200 ]; then
        message=$(printf '%s' "$response" | grep -o '"message": *"[^"]*"' | head -n 1)
        message=${message%\"}
        message=${message##*\"}
        log "GitHub API request failed: HTTP $status${message:+: $message} ($1)" >&2
        return 1
    fi
    printf '%s\n' "$response"
}

tag_name() {
    tag_field=$(grep -o '"tag_name": *"[^"]*"' | head -n 1)
    tag_field=${tag_field%\"}
    printf '%s\n' "${tag_field##*\"}"
}

asset_url() {
    tr -d '\n\r' \
        | awk '{ gsub(/"[[:space:]]*:[[:space:]]*/, "\":"); gsub(/}[[:space:]]*,[[:space:]]*{/, "}\n{"); print }' \
        | grep -F "\"name\":\"$1\"" \
        | grep -o 'https://api\.github\.com/repos/[^"]*/releases/assets/[0-9]*' \
        | head -n 1
}

case $(uname -sm) in
    "Darwin x86_64") target="darwin-amd64" ;;
    "Darwin arm64") target="darwin-arm64" ;;
    "Linux x86_64") target="linux-amd64" ;;
    "Linux aarch64") target="linux-arm64" ;;
    *) log "Unsupported platform $(uname -sm). x86_64 and arm64 binaries for Linux and Darwin are available."; exit ;;
esac

# check for dependencies
command -v curl >/dev/null || { log "curl isn't installed!" >&2; exit 1; }
command -v tar >/dev/null || { log "tar isn't installed!" >&2; exit 1; }
command -v grep >/dev/null || { log "grep isn't installed!" >&2; exit 1; }

# download uri
if [ -z "$tag" ]; then
    release=$(gh_api https://api.github.com/repos/spicetify/cli/releases/latest) || exit 1
else
    release=$(gh_api "https://api.github.com/repos/spicetify/cli/releases/tags/v${tag#v}") || exit 1
fi

tag=$(printf '%s' "$release" | tag_name)
tag=${tag#v}

log "FETCHING Version $tag"

asset_name="spicetify-$tag-$target.tar.gz"
download_uri=$(printf '%s' "$release" | asset_url "$asset_name")
[ -z "$download_uri" ] && { log "No asset $asset_name in release v$tag" >&2; exit 1; }

# locations
tar="$spicetify_install/spicetify.tar.gz"

# installing
[ ! -d "$spicetify_install" ] && log "CREATING $spicetify_install" && mkdir -p "$spicetify_install"

log "DOWNLOADING $download_uri"
curl --fail --location --header 'Accept: application/octet-stream' --progress-bar --output "$tar" "$download_uri"

log "EXTRACTING $tar"
tar xzf "$tar" -C "$spicetify_install"

log "SETTING EXECUTABLE PERMISSIONS TO $exe"
chmod +x "$exe"

log "REMOVING $tar"
rm "$tar"

notfound() {
    cat << EOINFO
Manually add the directory to your \$PATH through your shell profile
export SPICETIFY_INSTALL="$spicetify_install"
export PATH="\$PATH:$spicetify_install"
EOINFO
}

endswith_newline() {
    [ "$(od -An -c "$1" | tail -1 | grep -o '.$')" = "\n" ]
}

check() {
    path="export PATH=\$PATH:$spicetify_install"
    shellrc=$HOME/$1

    if [ "$1" = ".zshrc" ] && [ -n "${ZDOTDIR}" ]; then
        shellrc=$ZDOTDIR/$1
    fi

    # Create shellrc if it doesn't exist
    if ! [ -f "$shellrc" ]; then
        log "CREATING $shellrc"
        touch "$shellrc"
    fi

    # Still checking again, in case touch command failed
    if [ -f "$shellrc" ]; then
        if ! grep -q "$spicetify_install" "$shellrc"; then
            log "APPENDING $spicetify_install to PATH in $shellrc"
            if ! endswith_newline "$shellrc"; then
                echo >> "$shellrc"
            fi
            echo "${2:-$path}" >> "$shellrc"
            export PATH="$spicetify_install:$PATH"
        else
            log "spicetify path already set in $shellrc, continuing..."
        fi
    else
        notfound
    fi
}

case $SHELL in
    *zsh) check ".zshrc" ;;
    *bash)
        [ -f "$HOME/.bashrc" ] && check ".bashrc"
        [ -f "$HOME/.bash_profile" ] && check ".bash_profile"
    ;;
    *fish) check ".config/fish/config.fish" "fish_add_path $spicetify_install" ;;
    *) notfound ;;
esac

case ":$PATH:" in
    *":$spicetify_install:"*) ;;
    *) export PATH="$spicetify_install:$PATH" ;;
esac

echo
log "spicetify v$tag was installed successfully to $spicetify_install"
if [ -n "${shellrc:-}" ] && [ -f "$shellrc" ]; then
    log "Open a new terminal or reload your shell profile to use spicetify:"
    log "  source \"$shellrc\""
    log "Then run 'spicetify --help' to get started"
else
    log "After adding spicetify to your PATH, run 'spicetify --help' to get started"
fi

echo "Do you want to install spicetify Marketplace? (Y/n)"
read -r choice < /dev/tty
if [ "$choice" = "N" ] || [ "$choice" = "n" ]; then
    echo "spicetify Marketplace installation aborted"
    exit 0
fi
echo "Starting the spicetify Marketplace installation script.."

marketplace_release=$(gh_api https://api.github.com/repos/spicetify/marketplace/releases/latest) || exit 1
marketplace_tag=$(printf '%s' "$marketplace_release" | tag_name)
marketplace_uri=$(printf '%s' "$marketplace_release" | asset_url marketplace.zip)
[ -z "$marketplace_uri" ] && { log "No asset marketplace.zip in Marketplace release $marketplace_tag" >&2; exit 1; }
marketplace_script_uri="https://raw.githubusercontent.com/spicetify/spicetify-marketplace/main/resources/install.sh"
marketplace_script=$(curl -fsSL "$marketplace_script_uri") \
    || { log "Cannot download the Marketplace installer from $marketplace_script_uri" >&2; exit 1; }

patched_script=$(printf '%s\n' "$marketplace_script" \
    | sed -e "s|^\([[:space:]]*\)download_uri=.*|\1download_uri=$marketplace_uri|" \
          -e 's|^\([[:space:]]*curl \)\(.*"\$download_uri"\)|\1--header "Accept: application/octet-stream" \2|')
if printf '%s' "$patched_script" | grep -qF "download_uri=$marketplace_uri" \
    && printf '%s' "$patched_script" | grep -qF -- '--header "Accept: application/octet-stream"'; then
    marketplace_script=$patched_script
else
    log "WARNING: the Marketplace installer changed its download code, so it runs unmodified and downloads marketplace.zip itself (this may fail with 504)"
fi
printf '%s\n' "$marketplace_script" | sh -s -- "$marketplace_tag"
