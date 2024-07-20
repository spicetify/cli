#!/usr/bin/env sh
set -e

version=$1

mkdir Volume
osacompile -x -o Volume/Spicetify.app main.applescript
rm Volume/Spicetify.app/Contents/Resources/applet.icns
cp installer/spicetify.icns Volume/Spicetify.app/Contents/Resources/spicetify.icns

GOARCH="amd64" go build -C ../../ -o build/macos/spicetify-amd64 -ldflags "-X main.version=$version"
GOARCH="arm64" go build -C ../../ -o build/macos/spicetify-arm64 -ldflags "-X main.version=$version"
mkdir -p Volume/Spicetify.app/Contents/MacOS/bin
lipo -create -output Volume/Spicetify.app/Contents/MacOS/bin/spicetify spicetify-amd64 spicetify-arm64

plutil -replace CFBundleName -string "Spicetify" Volume/Spicetify.app/Contents/Info.plist
plutil -replace CFBundleIconFile -string spicetify.icns Volume/Spicetify.app/Contents/Info.plist
plutil -replace CFBundleURLTypes -xml '<array><dict><key>CFBundleURLName</key><string>Spicetify</string><key>CFBundleURLSchemes</key><array><string>spicetify</string></array></dict></array>' Volume/Spicetify.app/Contents/Info.plist

codesign --deep --force --sign - --timestamp=none Volume/Spicetify.app

# TODO: make use of real background image
create-dmg \
  --volname "Spicetify" \
  --volicon "installer/spicetify.icns" \
  --background "installer/banner.png" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "Spicetify.app" 200 190 \
  --hide-extension "Spicetify.app" \
  --app-drop-link 600 185 \
  spicetify.dmg Volume/
