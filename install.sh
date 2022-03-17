#!/usr/bin/env sh
# Copyright 2022 khanhas. GPL license.
# Edited from project Denoland install script (https://github.com/denoland/deno_install)

set -e

case $(uname -sm) in
	"Darwin x86_64") target="darwin-amd64" ;;
	"Darwin arm64") target="darwin-arm64" ;;
	"Linux x86_64") target="linux-amd64" ;;
	*) echo "Unsupported platform $(uname -sm). Only Darwin x86_64, Darwin arm64 and Linux x86_64 binaries are available."; exit ;;
esac

command -v curl >/dev/null || { echo "curl isn't installed\!" >&2; exit 1; }
command -v tar >/dev/null || { echo "tar isn't installed\!" >&2; exit 1; }

# download uri
shortcut=https://github.com/spicetify/spicetify-cli
tag=$(curl -LsH 'Accept: application/json' $shortcut/releases/latest)
tag=${tag%\,\"update_url*}
tag=${tag##*tag_name\":\"}
tag=${tag%\"}
download_uri="$shortcut/releases/download/$tag/spicetify-${tag#v}-$target.tar.gz"
unset tag

# locations
spicetify_install="${XDG_DATA_HOME:-$HOME/.local/share}/spicetify"
exe="$spicetify_install/spicetify"
tar="$spicetify_install/spicetify.tar.gz"

[ ! -d "$spicetify_install" ] && echo "CREATING $spicetify_install" && mkdir -p "$spicetify_install"
echo "DOWNLOADING  $download_uri"
curl --fail --location --progress-bar --output "$tar" "$download_uri"

echo "EXTRACTING $tar"
tar xzf "$tar" -C "$spicetify_install"

echo "SETTING EXECUTABLE PERMISSIONS TO $exe"
chmod +x "$exe"

echo "REMOVING $tar"
rm "$tar"

echo "spicetify was installed successfully to $spicetify_install"

cat << EOINFO

Manually add the directory to your \$PATH through your shell profile
  export SPICETIFY_INSTALL="$spicetify_install"
  export PATH="\$PATH:$spicetify_install"

	for zsh: $HOME/.zshrc 
	for bash: $HOME/.bashrc
	for fish: $HOME/.config/fish/config.fish

EOINFO

