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

bin_dir="dist/staging"
mkdir -p "$bin_dir"
cp "../../target/$target/release/spicetify" "$bin_dir/spicetify"
cp "../../target/$target/release/spicetify-daemon" "$bin_dir/spicetify-daemon"

archive_name="spicetify-$version-$output_arch-linux.tar.zst"
tar -c -I "zstd -T0" -f "dist/$archive_name" -C "$bin_dir" spicetify spicetify-daemon

cp "$bin_dir/spicetify" "dist/portable-spicetify-$version-linux-$output_arch"

rm -rf "$bin_dir"

#TODO: make AppImage
