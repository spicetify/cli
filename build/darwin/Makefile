spicetify.app: ../../*.go Makefile Info.plist
	pushd ../../
	rm -rf spicetify.app
	mkdir spicetify.app/
	cp -r Contents spicetify.app/Contents
	go build -o spicetify.app/Contents/MacOS/spicetify
	popd

.PHONY: open
open: spicetify.app
	open spicetify.app

.PHONY: clean
clean:
	rm -rf spicetify.app
