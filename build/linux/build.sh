#!/usr/bin/env sh
set -e

version=$1
arch=$2

GOARCH="$arch" go build -C ../../ -o "./build/linux/dist/cli-$version-linux-$arch" -ldflags "-X main.version=$version"

#TODO: make AppImage
