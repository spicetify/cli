#!/usr/bin/env sh
# Copyright 2022 khanhas.
# Copyright 2023-present Spicetify contributors.
# Edited from project Denoland install script (https://github.com/denoland/deno_install)

set -e

channel=${SPICETIFY_CHANNEL:-v2}

for arg in "$@"; do
    shift
    case "$arg" in
        "--root") override_root=1 ;;
        "--v3") channel=v3 ;;
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

# wipe existing log
> install.log :

log() {
    echo "$1"
    echo "[$(date +'%H:%M:%S %Y-%m-%d')]" "$1" >> install.log
}

if [ "$channel" = "v3" ]; then
    # v3 asset names come from the Rust CLI's own target triple, so that
    # `spicetify self-update` resolves the same file this script installs.
    case $(uname -sm) in
        "Darwin x86_64") target="macos-x86_64" ;;
        "Darwin arm64") target="macos-aarch64" ;;
        "Linux x86_64") target="linux-x86_64" ;;
        *) log "v3 has no build for $(uname -sm) yet. macOS (x86_64, arm64) and Linux x86_64 are available."; exit 1 ;;
    esac
    archive_ext="tar.zst"
else
    case $(uname -sm) in
        "Darwin x86_64") target="darwin-amd64" ;;
        "Darwin arm64") target="darwin-arm64" ;;
        "Linux x86_64") target="linux-amd64" ;;
        "Linux aarch64") target="linux-arm64" ;;
        *) log "Unsupported platform $(uname -sm). x86_64 and arm64 binaries for Linux and Darwin are available."; exit ;;
    esac
    archive_ext="tar.gz"
fi

# check for dependencies
command -v curl >/dev/null || { log "curl isn't installed!" >&2; exit 1; }
command -v tar >/dev/null || { log "tar isn't installed!" >&2; exit 1; }
command -v grep >/dev/null || { log "grep isn't installed!" >&2; exit 1; }

# download uri
releases_uri=https://github.com/spicetify/cli/releases
if [ -z "$tag" ]; then
    if [ "$channel" = "v3" ]; then
        # v3 ships as prereleases, which /releases/latest never returns, so the
        # newest v3 tag is picked out of the full list (newest first).
        tag=$(curl -LsH 'Accept: application/vnd.github+json' \
            https://api.github.com/repos/spicetify/cli/releases \
            | grep '"tag_name"' \
            | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/' \
            | grep '^v3' \
            | head -n 1)
        if [ -z "$tag" ]; then
            log "No v3 release published yet. Omit --v3 to install the current stable release."
            exit 1
        fi
    else
        tag=$(curl -LsH 'Accept: application/json' $releases_uri/latest)
        tag=${tag%\,\"update_url*}
        tag=${tag##*tag_name\":\"}
        tag=${tag%\"}
    fi
fi

tag=${tag#v}

log "FETCHING Version $tag"

download_uri=$releases_uri/download/v$tag/spicetify-$tag-$target.$archive_ext

# locations
spicetify_install="$HOME/.spicetify"
exe="$spicetify_install/spicetify"
tar="$spicetify_install/spicetify.$archive_ext"

# installing
[ ! -d "$spicetify_install" ] && log "CREATING $spicetify_install" && mkdir -p "$spicetify_install"

log "DOWNLOADING $download_uri"
curl --fail --location --progress-bar --output "$tar" "$download_uri"

log "EXTRACTING $tar"
if [ "$channel" = "v3" ]; then
    if command -v zstd >/dev/null; then
        zstd -dc "$tar" | tar -xf - -C "$spicetify_install"
    elif tar --zstd -xf "$tar" -C "$spicetify_install" 2>/dev/null; then
        :
    else
        log "zstd is required to unpack v3 archives. Install it (brew install zstd, apt install zstd) and re-run."
        exit 1
    fi
else
    tar xzf "$tar" -C "$spicetify_install"
fi

log "SETTING EXECUTABLE PERMISSIONS TO $exe"
chmod +x "$exe"
if [ "$channel" = "v3" ] && [ -f "$spicetify_install/spicetify-daemon" ]; then
    chmod +x "$spicetify_install/spicetify-daemon"
fi

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
log "Run 'spicetify --help' to get started"

if [ "$channel" = "v3" ]; then
    log "This is a v3 preview. Modules are managed in-app through the Module Store, so there is no Marketplace step."
    log "Next: run 'spicetify init' then 'spicetify apply'."
    exit 0
fi

echo "Do you want to install spicetify Marketplace? (Y/n)"
read -r choice < /dev/tty
if [ "$choice" = "N" ] || [ "$choice" = "n" ]; then
    echo "spicetify Marketplace installation aborted"
    exit 0
fi
echo "Starting the spicetify Marketplace installation script.."
curl -fsSL "https://raw.githubusercontent.com/spicetify/spicetify-marketplace/main/resources/install.sh" | sh
