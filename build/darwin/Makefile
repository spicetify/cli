spicetify.app: ../../*.go Makefile
	rm -rf ../../spicetify.app
	mkdir -p ../../spicetify.app/
	cp -r Contents ../../spicetify.app/Contents
	mkdir -p ../../spicetify.app/Contents/MacOS/bin
	go build -C ../../ -o spicetify.app/Contents/MacOS/bin/spicetify

.PHONY: open
open: spicetify.app
	open spicetify.app

.PHONY: clean
clean:
	rm -rf spicetify.app
