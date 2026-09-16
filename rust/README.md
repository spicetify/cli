# Spicetify v3

This directory contains the Rust CLI, daemon, core library, and TUI for
Spicetify v3. The active development branch is `v3-beta`.

Use the
[Spicetify v3 installation guide](https://spicetify.app/docs/getting-started)
for a normal installation. The steps below are for development builds from
this repository.

## Requirements

- Rust 1.95 or newer.
- Node.js 18 or newer.
- pnpm 8 or newer. The repository pins pnpm 11.9.0.
- A supported native Spotify desktop installation.

Microsoft Store, Snap, and Flatpak builds are sandboxed and cannot be patched.

## Build the CLI and daemon

Build the JavaScript payload before the Rust binaries. The Rust build embeds
the generated files from `dist/hooks/`, so a later payload change requires
another Rust build.

From the repository root, run:

```sh
pnpm install --frozen-lockfile
pnpm build:payload
cd rust
cargo build --release -p cli -p daemon
```

Run the development binary directly:

```sh
./target/release/spicetify --version
./target/release/spicetify apply
```

Keep `spicetify-daemon` beside `spicetify`. The CLI starts the daemon from its
own directory.

To test a just-published compatibility fix without local or CDN caches, run
`./target/release/spicetify apply --no-cache`. This requires network access and
refreshes compatibility data, including classmaps and exposure patches. See
[refreshing a newly published fix](../docs/supported-versions.md#refresh-a-newly-published-fix)
for scope, failure behavior, and developer overrides.

## Restart the daemon after local changes

A local rebuild keeps the same crate version. The CLI therefore cannot detect
that a running daemon contains older code. After changing the daemon or shared
core code, rebuild both binaries and restart the daemon:

```sh
cargo build --release -p cli -p daemon
./target/release/spicetify daemon stop
./target/release/spicetify daemon start
```

## Don't mix v2 and v3 apply state

The Go and Rust CLIs use different backup layouts. Restore Spotify with the
same CLI that applied it before switching implementations. Mixing the two can
leave Spotify without a usable `xpui.spa` or `index.html`.

The installer-managed `spicetify` on your `PATH` is not replaced by
`cargo build`. Use `./target/release/spicetify` when testing local Rust code.

## Verify changes

Run the checks that cover the files you changed. The full Rust checks are:

```sh
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

After changing the wrapper or modular loader, rebuild the payload and run the
relevant Node tests before rebuilding the Rust binaries.
