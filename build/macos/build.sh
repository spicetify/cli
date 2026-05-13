#!/usr/bin/env sh
set -e

version=$1

cargo build --release --target x86_64-apple-darwin --manifest-path ../../Cargo.toml
cargo build --release --target aarch64-apple-darwin --manifest-path ../../Cargo.toml

mkdir -p dist
lipo -create -output "dist/portable-spicetify-$version-macos" \
	../../target/x86_64-apple-darwin/release/spicetify \
	../../target/aarch64-apple-darwin/release/spicetify

mkdir -p ./Volume
osacompile -x -o ./Volume/Spicetify.app main.applescript
rm -f ./Volume/Spicetify.app/Contents/Resources/applet.icns
cp ./installer/AppIcon.icns ./Volume/Spicetify.app/Contents/Resources/AppIcon.icns

mkdir -p ./Volume/Spicetify.app/Contents/MacOS/bin/
cp "dist/portable-spicetify-$version-macos" ./Volume/Spicetify.app/Contents/MacOS/bin/spicetify
ln -sf ./spicetify ./Volume/Spicetify.app/Contents/MacOS/bin/spotify

plutil -replace CFBundleName -string "Spicetify" ./Volume/Spicetify.app/Contents/Info.plist
plutil -replace CFBundleIconFile -string AppIcon.icns ./Volume/Spicetify.app/Contents/Info.plist
plutil -replace CFBundleShortVersionString -string "$version" ./Volume/Spicetify.app/Contents/Info.plist
plutil -replace CFBundleVersion -string "$version" ./Volume/Spicetify.app/Contents/Info.plist
plutil -replace CFBundleURLTypes -xml '<array><dict><key>CFBundleURLName</key><string>Spicetify</string><key>CFBundleURLSchemes</key><array><string>spicetify</string></array></dict></array>' ./Volume/Spicetify.app/Contents/Info.plist

codesign --deep --force --sign - --timestamp=none ./Volume/Spicetify.app

create-dmg \
	--volname "Spicetify" \
	--volicon "./installer/VolumeIcon.icns" \
	--background "./installer/banner.png" \
	--window-pos 200 120 \
	--window-size 660 400 \
	--icon-size 160 \
	--icon "Spicetify.app" 180 170 \
	--hide-extension "Spicetify.app" \
	--app-drop-link 480 170 \
	"dist/installer-$version-macos.dmg" ./Volume/
