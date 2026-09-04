#!/usr/bin/env sh
set -eu

repo_root=$(cd "$(dirname "$0")/.." && pwd)
temp_dir=$(mktemp -d)
trap 'rm -rf "$temp_dir"' EXIT

helpers="$temp_dir/helpers.sh"
sed -n '/^# BEGIN shell completion helpers$/,/^# END shell completion helpers$/p' \
    "$repo_root/install.sh" > "$helpers"

log() { :; }

# shellcheck source=/dev/null
. "$helpers"

assert_one_line() {
    file=$1
    expected=$2
    actual=$(grep -Fxc "$expected" "$file" || true)
    if [ "$actual" -ne 1 ]; then
        echo "Expected one completion line in $file, found $actual" >&2
        exit 1
    fi
}

run_case() {
    shell_name=$1
    expected_file=$2
    expected_line=$3

    case_home="$temp_dir/$shell_name"
    config_file="$case_home/$expected_file"
    mkdir -p "$(dirname "$config_file")"
    printf '%s' '# existing config' > "$config_file"
    (
        HOME=$case_home
        SHELL="/bin/$shell_name"
        XDG_CONFIG_HOME="$case_home/.config"
        ZDOTDIR=$case_home
        channel=v3
        export HOME SHELL XDG_CONFIG_HOME ZDOTDIR
        install_shell_completion
        install_shell_completion
    )

    assert_one_line "$case_home/$expected_file" "$expected_line"
    if [ "$(sed -n '1p' "$config_file")" != '# existing config' ]; then
        echo "Completion was not separated from existing content in $config_file" >&2
        exit 1
    fi
}

run_case bash .bashrc 'source <(COMPLETE=bash spicetify)'
run_case zsh .zshrc 'source <(COMPLETE=zsh spicetify)'
run_case fish .config/fish/completions/spicetify.fish 'COMPLETE=fish spicetify | source'
run_case elvish .elvish/rc.elv 'eval (E:COMPLETE=elvish spicetify | slurp)'

v2_home="$temp_dir/v2"
mkdir -p "$v2_home"
(
    HOME=$v2_home
    SHELL=/bin/zsh
    channel=v2
    export HOME SHELL channel
    install_shell_completion
)
if [ -e "$v2_home/.zshrc" ]; then
    echo "v2 install unexpectedly configured v3 completion" >&2
    exit 1
fi
