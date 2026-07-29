#!/usr/bin/env sh
set -eu

echo "Uninstalling Spicetify..."

if command -v spicetify >/dev/null 2>&1; then
    spicetify restore 2>/dev/null || echo "Warning: restore failed (Spotify may not be patched)"
fi

rm -f "$HOME/.local/bin/spicetify"
rm -f "$HOME/.local/bin/spicetify-daemon"
rm -f "$HOME/.local/share/applications/spicetify.desktop"
rm -f "$HOME/.local/share/icons/spicetify.png"
systemctl --user disable --now spicetify-daemon 2>/dev/null || true
systemctl --user daemon-reload 2>/dev/null || true
rm -f "$HOME/.config/systemd/user/spicetify-daemon.service"

echo "Spicetify uninstalled."
echo "Config and data at ~/.config/spicetify/ were left untouched."
echo "To remove them: rm -rf ~/.config/spicetify/"
