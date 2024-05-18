spicetify.app: ../../*.go Makefile Info.plist
	rm -rf ../../dist/spicetify.app
	mkdir -p ../../dist/spicetify.app/Contents/MacOS
	go build -C ../../ -o dist/spicetify.app/Contents/MacOS/spicetify
	cp Info.plist ../../dist/spicetify.app/Contents/Info.plist
	cp -r Resources ../../dist/spicetify.app/Contents/Resources
	cp urihandler ../../dist/spicetify.app/Contents/MacOS/urihandler
	echo "APPLaplt" >> ../../dist/spicetify.app/Contents/PkgInfo

.PHONY: open
open: spicetify.app
	open spicetify.app

.PHONY: clean
clean:
	rm -rf dist/spicetify.app
