#!/usr/bin/env sh
set -e

version=$1
arch=$2

case $arch in
	x86_64) target="x86_64-unknown-linux-gnu" ;;
	*)     echo "unsupported arch: $arch" && exit 1 ;;
esac

cargo build --release --target "$target" --manifest-path ../../Cargo.toml

mkdir -p dist
case $arch in
	x86_64) output_arch="x86_64" ;;
	*) output_arch="$arch" ;;
esac

cp "../../target/$target/release/spicetify" "dist/spicetify"
cp "../../target/$target/release/spicetify-daemon" "dist/spicetify-daemon"
cp install.sh "dist/install.sh"

archive_name="spicetify-$version-linux-$output_arch.tar.zst"
tar --zstd -cf "dist/$archive_name" -C dist spicetify spicetify-daemon install.sh

cp "dist/spicetify" "dist/portable-spicetify-$version-linux-$output_arch"

rm -f "dist/spicetify" "dist/spicetify-daemon" "dist/install.sh"
