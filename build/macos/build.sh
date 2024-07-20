#!/usr/bin/env sh
set -e

mkdir Volume && mkdir -p bin
lipo -create -output bin/spicetify ../../artifacts/spicetify-amd64 ../../artifacts/spicetify-arm64 && echo "Built universal binary"

# Build the helper app with xcode
git clone https://github.com/rxri/spicetify-macos-helper.git
cd spicetify-macos-helper
cp -r ../bin spicetify/bin
sudo xcode-select -s /Applications/Xcode_15.4.app/Contents/Developer
xcodebuild -project spicetify.xcodeproj -scheme spicetify -configuration Release build SYMROOT="$(pwd)/build"
cp -r build/Release/spicetify.app ../Volume/Spicetify.app
cd ..

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
