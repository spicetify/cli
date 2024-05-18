spicetify.app: ../../*.go Makefile Info.plist
	pushd ../../
	rm -rf spicetify.app
	mkdir -p spicetify.app/Contents/MacOS
	go build -o spicetify.app/Contents/MacOS/bin/spicetify
	cp Info.plist spicetify.app/Contents/Info.plist
	cp -r Resources spicetify.app/Contents/Resources
	cp applet spicetify.app/Contents/MacOS/applet
	echo "APPLaplt" >> spicetify.app/Contents/PkgInfo
	popd

.PHONY: open
open: spicetify.app
	open spicetify.app

.PHONY: clean
clean:
	rm -rf spicetify.app
