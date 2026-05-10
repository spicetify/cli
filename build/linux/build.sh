#!/usr/bin/env sh
set -e

version=$1
arch=$2

case $arch in
	amd64) target="x86_64-unknown-linux-gnu" ;;
	*)     echo "unsupported arch: $arch" && exit 1 ;;
esac

cargo build --release --target "$target" --manifest-path ../../Cargo.toml

mkdir -p dist
cp "../../target/$target/release/spicetify" "dist/spicetify-$version-linux-$arch"

#TODO: make AppImage
