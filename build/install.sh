#!/usr/bin/env sh
set -eu

main() {
	if ! command -v curl >/dev/null 2>&1; then
		echo "Error: curl is required to install Spicetify" >&2
		exit 1
	fi

	case $(uname -sm) in
		"Darwin x86_64") os="macos"; arch="x86_64" ;;
		"Darwin arm64")  os="macos"; arch="aarch64" ;;
		"Linux x86_64")  os="linux"; arch="x86_64" ;;
		*) echo "Error: unsupported platform $(uname -sm)" >&2; exit 1 ;;
	esac

	version=$(curl -fsSL "https://api.github.com/repos/veryboringhwl/app/releases/latest" 2>/dev/null \
		| grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
	if [ -z "$version" ]; then
		echo "Error: could not determine latest version" >&2
		exit 1
	fi

	case $os in
		macos) install_macos ;;
		linux) install_linux ;;
	esac

	export PATH="${bin_dir}:${PATH}"

	echo "Spicetify ${version} installed${install_note}"

	echo ""
	echo "Initializing Spicetify..."
	"${bin_dir}/spicetify" init
	"${bin_dir}/spicetify" apply

	echo ""
	echo "Done. Run 'spicetify' to get started"
}

install_macos() {
	archive="spicetify-${version}-macos-${arch}.dmg"
	uri="https://github.com/veryboringhwl/app/releases/download/v${version}/${archive}"

	echo "Downloading Spicetify ${version}..."

	temp=$(mktemp -d)
	curl --fail --location --progress-bar --output "${temp}/${archive}" "$uri"

	hdiutil attach -quiet "${temp}/${archive}" -mountpoint "${temp}/mount"
	cleanup() {
		hdiutil detach -quiet "${temp}/mount" 2>/dev/null || true
		rm -rf "$temp"
	}
	trap cleanup EXIT

	mkdir -p "$HOME/Applications"
	ditto "${temp}/mount/Spicetify.app" "$HOME/Applications/Spicetify.app"

	cleanup
	trap - EXIT

	bin_dir="$HOME/Applications/Spicetify.app/Contents/MacOS"

	install_note=" to ~/Applications/Spicetify.app"

	ensure_in_path
}

install_linux() {
	bin_dir="$HOME/.local/bin"
	icon_dir="$HOME/.local/share/icons"
	mkdir -p "$bin_dir" "$icon_dir"

	archive="spicetify-${version}-${arch}-linux.tar.zst"
	uri="https://github.com/veryboringhwl/app/releases/download/v${version}/${archive}"

	echo "Downloading Spicetify ${version}..."

	temp=$(mktemp -d)
	trap 'rm -rf "$temp"' EXIT
	curl --fail --location --progress-bar --output "${temp}/${archive}" "$uri"

	if ! tar --zstd -xf "${temp}/${archive}" -C "$bin_dir" 2>/dev/null; then
		if command -v zstd >/dev/null 2>&1; then
			zstd -d "${temp}/${archive}" -o "${temp}/spicetify.tar"
			tar -xf "${temp}/spicetify.tar" -C "$bin_dir"
		else
			echo "Error: tar does not support zstd, and zstd command not found" >&2
			echo "Install zstd and try again" >&2
			exit 1
		fi
	fi

	chmod +x "${bin_dir}/spicetify"
	chmod +x "${bin_dir}/spicetify-daemon"

	# Install custom icon if available
	icon_path="utilities-terminal"
	if [ -f "./images/spicetify.png" ]; then
		cp "./images/spicetify.png" "${icon_dir}/spicetify.png"
		icon_path="${icon_dir}/spicetify.png"
	elif [ -f "${temp}/images/spicetify.png" ]; then
		cp "${temp}/images/spicetify.png" "${icon_dir}/spicetify.png"
		icon_path="${icon_dir}/spicetify.png"
	fi

	mkdir -p "$HOME/.local/share/applications"
	cat > "$HOME/.local/share/applications/spicetify.desktop" << DESKTOP_EOF
[Desktop Entry]
Type=Application
Name=Spicetify
Comment=Customize your Spotify experience
GenericName=Spotify Customization Tool
Exec=${bin_dir}/spicetify
Icon=${icon_path}
Terminal=true
Categories=Audio;Music;Utility;
Keywords=spotify;customize;theme;plugin;
StartupNotify=false
StartupWMClass=spicetify
DESKTOP_EOF

	install_note=" to ${bin_dir}"

	ensure_in_path
}

ensure_in_path() {
	if echo "$PATH" | tr ':' '\n' | grep -qF "$bin_dir"; then
		return
	fi

	export_line="export PATH=\"${bin_dir}:\$PATH\"  # spicetify"

	case "${SHELL##*/}" in
	fish)
		if command -v fish >/dev/null 2>&1; then
			fish -c "fish_add_path -U ${bin_dir}" 2>/dev/null || true
		fi
		;;
	zsh)
		rc="$HOME/.zshrc"
		grep -qF "${bin_dir}" "$rc" 2>/dev/null \
			|| echo "$export_line" >> "$rc" 2>/dev/null \
			|| echo "Add this to your shell config: ${export_line}"
		;;
	*)
		saved=false
		for rc in "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile"; do
			if grep -qF "${bin_dir}" "$rc" 2>/dev/null; then
				return
			fi
			if echo "$export_line" >> "$rc" 2>/dev/null; then
				saved=true
				break
			fi
		done
		if ! $saved; then
			echo "Add this to your shell config: ${export_line}"
		fi
		;;
	esac
}

main "$@"
