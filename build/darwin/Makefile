spicetify.app: ../../*.go *.h *.m Makefile Info.plist
	mkdir -p ../../dist/spicetify.app/Contents/MacOS
	go build -C ../../ -o dist/spicetify.app/Contents/MacOS/spicetify
	cp Info.plist ../../dist/spicetify.app/Contents/Info.plist

.PHONY: open
open: spicetify.app
	open spicetify.app

.PHONY: scheme
scheme: spicetify.app
	open spicetify://protocol

.PHONY: clean
clean:
	rm -rf dist/spicetify.app
