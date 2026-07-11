#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$HOME/.local/bin"

echo "Installing Spicetify to $BIN_DIR..."

mkdir -p "$BIN_DIR"
cp "$SCRIPT_DIR/spicetify" "$BIN_DIR/spicetify"
cp "$SCRIPT_DIR/spicetify-daemon" "$BIN_DIR/spicetify-daemon"
chmod +x "$BIN_DIR/spicetify" "$BIN_DIR/spicetify-daemon"

mkdir -p "$HOME/.local/share/applications"
cat > "$HOME/.local/share/applications/spicetify.desktop" << 'DESKTOP_EOF'
[Desktop Entry]
Type=Application
Name=Spicetify
Comment=Spicetify CLI
Icon=utilities-terminal
Exec=spicetify
Terminal=true
Categories=Utility;
DESKTOP_EOF

if echo "$PATH" | tr ':' '\n' | grep -qF "$BIN_DIR"; then
	:
else
	export_line="export PATH=\"$BIN_DIR:\$PATH\"  # spicetify"

	case "${SHELL##*/}" in
	fish)
		if command -v fish >/dev/null 2>&1; then
			fish -c "fish_add_path -U $BIN_DIR" 2>/dev/null || true
		fi
		;;
	zsh)
		rc="$HOME/.zshrc"
		grep -qF "$BIN_DIR" "$rc" 2>/dev/null \
			|| echo "$export_line" >> "$rc" 2>/dev/null \
			|| echo "Add this to your shell config: $export_line"
		;;
	*)
		done=false
		for rc in "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile"; do
			if grep -qF "$BIN_DIR" "$rc" 2>/dev/null; then
				done=true
				break
			fi
			if echo "$export_line" >> "$rc" 2>/dev/null; then
				done=true
				break
			fi
		done
		if ! $done; then
			echo "Add this to your shell config: $export_line"
		fi
		;;
	esac
fi

export PATH="$BIN_DIR:$PATH"

echo ""
echo "Initializing Spicetify..."
"$BIN_DIR/spicetify" init
"$BIN_DIR/spicetify" apply

echo ""
echo "Done. Run 'spicetify' to get started"
