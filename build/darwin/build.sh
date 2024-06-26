#!/usr/bin/env sh

osacompile -o spicetify.app main.applescript
rm -rf spicetify.app/_CodeSignature
go build -C ../../ -o spicetify.app/Contents/MacOS/bin/spicetify

brew install xmlstarlet

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
  spicetify.app/Contents/Info.plist
