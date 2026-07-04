#!/usr/bin/env sh
set -e

version=$1
output_dir="dist"

cargo build --release --target x86_64-apple-darwin --manifest-path ../../Cargo.toml
cargo build --release --target aarch64-apple-darwin --manifest-path ../../Cargo.toml

mkdir -p "$output_dir"
lipo -create -output "$output_dir/spicetify" \
	../../target/x86_64-apple-darwin/release/spicetify \
	../../target/aarch64-apple-darwin/release/spicetify
lipo -create -output "$output_dir/spicetify-daemon" \
	../../target/x86_64-apple-darwin/release/spicetify-daemon \
	../../target/aarch64-apple-darwin/release/spicetify-daemon

osacompile -x -o "$output_dir/Spicetify.app" main.applescript

rm -f "$output_dir/Spicetify.app/Contents/Resources/applet.icns"
cp installer/AppIcon.icns "$output_dir/Spicetify.app/Contents/Resources/AppIcon.icns"

mkdir -p "$output_dir/Spicetify.app/Contents/MacOS/bin"
cp "$output_dir/spicetify" "$output_dir/Spicetify.app/Contents/MacOS/bin/spicetify"
cp "$output_dir/spicetify-daemon" "$output_dir/Spicetify.app/Contents/MacOS/bin/spicetify-daemon"

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
	"$output_dir/spicetify-$version-macos.dmg" \
	"$output_dir/Spicetify.app"

tar -c -I "zstd -T0" -f "$output_dir/spicetify-$version-macos.tar.zst" \
	-C "$output_dir" spicetify spicetify-daemon

rm -f "$output_dir/spicetify" "$output_dir/spicetify-daemon"
rm -rf "$output_dir/Spicetify.app"

echo ""
echo "  DMG:   $output_dir/spicetify-$version-macos.dmg"
echo "  tar:   $output_dir/spicetify-$version-macos.tar.gz"
