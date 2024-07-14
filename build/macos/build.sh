#!/usr/bin/env sh
set -e

version=$1

osacompile -o Spicetify.app main.applescript
rm -rf Spicetify.app/_CodeSignature

GOARCH="amd64" go build -C ../../ -o build/macos/spicetify-amd64 -ldflags "-X main.version=$version"
GOARCH="arm64" go build -C ../../ -o build/macos/spicetify-arm64 -ldflags "-X main.version=$version"
mkdir -p Spicetify.app/Contents/MacOS/bin
lipo -create -output Spicetify.app/Contents/MacOS/bin/spicetify spicetify-amd64 spicetify-arm64

xmlstarlet ed -L \
  -d "//plist/dict/key[text()='CFBundleName']" \
  -d "//plist/dict/key[text()='CFBundleName']/following-sibling::string[1]" \
  -s "//plist/dict" -t elem -n key -v "CFBundleName" \
  -a "//plist/dict/key[text()='CFBundleName']" -t elem -n string -v "Spicetify" \
  -d "//plist/dict/key[text()='CFBundleURLTypes']" \
  -d "//plist/dict/key[text()='CFBundleURLTypes']/following-sibling::array[1]" \
  -s "//plist/dict" -t elem -n key -v "CFBundleURLTypes" \
  -a "//plist/dict/key[text()='CFBundleURLTypes']" -t elem -n array \
  -s "//plist/dict/key[text()='CFBundleURLTypes']/following-sibling::array[1]" -t elem -n dict \
  -s "//plist/dict/key[text()='CFBundleURLTypes']/following-sibling::array[1]/dict" -t elem -n key -v "CFBundleURLName" \
  -a "//plist/dict/key[text()='CFBundleURLTypes']/following-sibling::array[1]/dict/key[text()='CFBundleURLName']" -t elem -n string -v "Spicetify" \
  -s "//plist/dict/key[text()='CFBundleURLTypes']/following-sibling::array[1]/dict" -t elem -n key -v "CFBundleURLSchemes" \
  -a "//plist/dict/key[text()='CFBundleURLTypes']/following-sibling::array[1]/dict/key[text()='CFBundleURLSchemes']" -t elem -n array \
  -s "//plist/dict/key[text()='CFBundleURLTypes']/following-sibling::array[1]/dict/key[text()='CFBundleURLSchemes']/following-sibling::array[1]" -t elem -n string -v "spicetify" \
  Spicetify.app/Contents/Info.plist

create-dmg \
  --volname "Spicetify" \
  --volicon "installer/spicetify.icns" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "Spicetify.app" 200 190 \
  --hide-extension "Spicetify.app" \
  --app-drop-link 600 185 \
  spicetify.dmg Spicetify.app
