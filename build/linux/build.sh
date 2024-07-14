#!/usr/bin/env sh
set -e

version=$1
arch=$2

GOARCH=$arch go build -o spicetify -C ../../ -ldflags "-X main.version=$version"
