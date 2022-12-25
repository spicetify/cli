#!/usr/bin/env sh
# Copyright 2022 khanhas. GPL license.
# Edited from project Denoland install script (https://github.com/denoland/deno_install)

set -e

case $(uname -sm) in
	"Darwin x86_64") target="darwin-amd64" ;;
	"Darwin arm64") target="darwin-arm64" ;;
	"Linux x86_64") target="linux-amd64" ;;
	"Linux aarch64") target="linux-arm64" ;;
	*) echo "Unsupported platform $(uname -sm). x86_64 and arm64 binaries for Linux and Darwin are available."; exit ;;
esac

# check for dependencies
command -v curl >/dev/null || { echo "curl isn't installed\!" >&2; exit 1; }
command -v tar >/dev/null || { echo "tar isn't installed\!" >&2; exit 1; }
command -v grep >/dev/null || { echo "grep isn't installed\!" >&2; exit 1; }

# download uri
releases_uri=https://github.com/spicetify/spicetify-cli/releases
if [ $# -gt 0 ]; then
	tag=$1
else
	tag=$(curl -LsH 'Accept: application/json' $releases_uri/latest)
	tag=${tag%\,\"update_url*}
	tag=${tag##*tag_name\":\"}
	tag=${tag%\"}
fi

tag=${tag#v}

echo "FETCHING Version $tag"

download_uri=$releases_uri/download/v$tag/spicetify-$tag-$target.tar.gz

# locations
spicetify_install="$HOME/.spicetify"
exe="$spicetify_install/spicetify"
tar="$spicetify_install/spicetify.tar.gz"

# installing
[ ! -d "$spicetify_install" ] && echo "CREATING $spicetify_install" && mkdir -p "$spicetify_install"

echo "DOWNLOADING $download_uri"
curl --fail --location --progress-bar --output "$tar" "$download_uri"

echo "EXTRACTING $tar"
tar xzf "$tar" -C "$spicetify_install"

echo "SETTING EXECUTABLE PERMISSIONS TO $exe"
chmod +x "$exe"

echo "REMOVING $tar"
rm "$tar"

notfound() {
	cat << EOINFO
Manually add the directory to your \$PATH through your shell profile
export SPICETIFY_INSTALL="$spicetify_install"
export PATH="\$PATH:$spicetify_install"
EOINFO
}

endswith_newline() {
    [[ $(tail -c1 "$1" | wc -l) -gt 0 ]]
}

check() {
	local path="export PATH=\$PATH:$spicetify_install"
	local shellrc=$HOME/$1

	# Create shellrc if it doesn't exist
	if ! [ -f $shellrc ]; then
		echo "CREATING $shellrc"
		touch $shellrc
	fi

	# Still checking again, in case touch command failed
	if [ -f $shellrc ]; then
		if ! grep -q $spicetify_install $shellrc; then
			echo "APPENDING $spicetify_install to PATH in $shellrc"
			if ! endswith_newline $shellrc; then
				echo >> $shellrc
			fi
			echo ${2:-$path} >> $shellrc
			echo "Restart your shell to have spicetify in your PATH."
		else
			echo "spicetify path already set in $shellrc, continuing..."
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

echo
echo "spicetify v$tag was installed successfully to $spicetify_install"
echo "Run 'spicetify --help' to get started"
