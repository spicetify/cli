#!/usr/bin/env sh
set -e

version=$1
arch=$2

case $arch in
	x86_64) target="x86_64-apple-darwin" ;;
	aarch64) target="aarch64-apple-darwin" ;;
	*) echo "unsupported arch: $arch" && exit 1 ;;
esac

cargo build --release --target "$target" --manifest-path ../../Cargo.toml

output_dir="dist"
mkdir -p "$output_dir"

cp "../../target/$target/release/spicetify" "$output_dir/spicetify"
cp "../../target/$target/release/spicetify-daemon" "$output_dir/spicetify-daemon"

osacompile -x -o "$output_dir/Spicetify.app" main.applescript

rm -f "$output_dir/Spicetify.app/Contents/Resources/applet.icns"
cp installer/AppIcon.icns "$output_dir/Spicetify.app/Contents/Resources/AppIcon.icns"

cp "$output_dir/spicetify" "$output_dir/Spicetify.app/Contents/MacOS/spicetify"
cp "$output_dir/spicetify-daemon" "$output_dir/Spicetify.app/Contents/MacOS/spicetify-daemon"

INFO="$output_dir/Spicetify.app/Contents/Info.plist"

plutil -replace CFBundleName -string "Spicetify" "$INFO"
plutil -replace CFBundleIdentifier -string "app.spicetify.cli" "$INFO"
plutil -replace CFBundleIconFile -string AppIcon.icns "$INFO"
plutil -replace CFBundleURLTypes -xml '<array><dict><key>CFBundleURLName</key><string>Spicetify Protocol</string><key>CFBundleURLSchemes</key><array><string>spicetify</string></array></dict></array>' "$INFO"

plutil -remove NSAppleEventsUsageDescription "$INFO" 2>/dev/null || true
plutil -remove NSAppleMusicUsageDescription "$INFO" 2>/dev/null || true
plutil -remove NSCalendarsUsageDescription "$INFO" 2>/dev/null || true
plutil -remove NSCameraUsageDescription "$INFO" 2>/dev/null || true
plutil -remove NSContactsUsageDescription "$INFO" 2>/dev/null || true
plutil -remove NSHomeKitUsageDescription "$INFO" 2>/dev/null || true
plutil -remove NSMicrophoneUsageDescription "$INFO" 2>/dev/null || true
plutil -remove NSPhotoLibraryUsageDescription "$INFO" 2>/dev/null || true
plutil -remove NSRemindersUsageDescription "$INFO" 2>/dev/null || true
plutil -remove NSSiriUsageDescription "$INFO" 2>/dev/null || true
plutil -remove NSSystemAdministrationUsageDescription "$INFO" 2>/dev/null || true

codesign --deep --force --sign - --timestamp=none "$output_dir/Spicetify.app"

create-dmg \
	--volname "Spicetify" \
	--volicon "installer/VolumeIcon.icns" \
	--background "installer/banner.png" \
	--window-pos 200 120 \
	--window-size 660 400 \
	--icon-size 160 \
	--icon "Spicetify.app" 180 170 \
	--hide-extension "Spicetify.app" \
	--app-drop-link 480 170 \
	"$output_dir/spicetify-$version-macos-$arch.dmg" \
	"$output_dir/Spicetify.app"

tar -c --zstd -f "$output_dir/spicetify-$version-macos-$arch.tar.zst" \
	-C "$output_dir" spicetify spicetify-daemon

rm -f "$output_dir/spicetify" "$output_dir/spicetify-daemon"
rm -rf "$output_dir/Spicetify.app"

echo ""
echo "  DMG:   $output_dir/spicetify-$version-macos-$arch.dmg"
echo "  tar:   $output_dir/spicetify-$version-macos-$arch.tar.zst"
