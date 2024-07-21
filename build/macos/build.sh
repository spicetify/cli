#!/usr/bin/env sh
set -e

mkdir Volume && mkdir -p bin
osacompile -x -o Volume/Spicetify.app main.applescript
rm Volume/Spicetify.app/Contents/Resources/applet.icns
cp installer/AppIcon.icns Volume/Spicetify.app/Contents/Resources/AppIcon.icns
lipo -create -output bin/spicetify ../../artifacts/spicetify-amd64 ../../artifacts/spicetify-arm64 && echo "Built universal binary"

mkdir -p Volume/Spicetify.app/Contents/MacOS/bin
cp bin/spicetify Volume/Spicetify.app/Contents/MacOS/bin/spicetify
plutil -replace CFBundleName -string "Spicetify" Volume/Spicetify.app/Contents/Info.plist
plutil -replace CFBundleIconFile -string AppIcon.icns Volume/Spicetify.app/Contents/Info.plist
plutil -replace CFBundleURLTypes -xml '<array><dict><key>CFBundleURLName</key><string>Spicetify</string><key>CFBundleURLSchemes</key><array><string>spicetify</string></array></dict></array>' Volume/Spicetify.app/Contents/Info.plist

codesign --deep --force --sign - --timestamp=none Volume/Spicetify.app

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
  spicetify.dmg Volume/
