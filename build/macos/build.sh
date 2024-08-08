#!/usr/bin/env sh
set -e

version=$1

mkdir Volume
osacompile -x -o Volume/Spicetify.app main.applescript
rm Volume/Spicetify.app/Contents/Resources/applet.icns
cp installer/AppIcon.icns Volume/Spicetify.app/Contents/Resources/AppIcon.icns

GOARCH="amd64" go build -C ../../ -o build/macos/spicetify-amd64 -ldflags "-X main.version=$version"
GOARCH="arm64" go build -C ../../ -o build/macos/spicetify-arm64 -ldflags "-X main.version=$version"
mkdir -p Volume/Spicetify.app/Contents/MacOS/bin
lipo -create -output Volume/Spicetify.app/Contents/MacOS/bin/spicetify spicetify-amd64 spicetify-arm64

plutil -replace CFBundleName -string "Spicetify" Volume/Spicetify.app/Contents/Info.plist
plutil -replace CFBundleIconFile -string AppIcon.icns Volume/Spicetify.app/Contents/Info.plist
plutil -replace CFBundleURLTypes -xml '<array><dict><key>CFBundleURLName</key><string>Spicetify</string><key>CFBundleURLSchemes</key><array><string>spicetify</string></array></dict></array>' Volume/Spicetify.app/Contents/Info.plist

# plutil -remove NSAppleEventsUsageDescription Volume/Spicetify.app/Contents/Info.plist
# plutil -remove NSAppleMusicUsageDescription Volume/Spicetify.app/Contents/Info.plist
# plutil -remove NSCalendarsUsageDescription Volume/Spicetify.app/Contents/Info.plist
# plutil -remove NSCameraUsageDescription Volume/Spicetify.app/Contents/Info.plist
# plutil -remove NSContactsUsageDescription Volume/Spicetify.app/Contents/Info.plist
# plutil -remove NSHomeKitUsageDescription Volume/Spicetify.app/Contents/Info.plist
# plutil -remove NSMicrophoneUsageDescription Volume/Spicetify.app/Contents/Info.plist
# plutil -remove NSPhotoLibraryUsageDescription Volume/Spicetify.app/Contents/Info.plist
# plutil -remove NSRemindersUsageDescription Volume/Spicetify.app/Contents/Info.plist
# plutil -remove NSSiriUsageDescription Volume/Spicetify.app/Contents/Info.plist
# plutil -remove NSSystemAdministrationUsageDescription Volume/Spicetify.app/Contents/Info.plist

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
