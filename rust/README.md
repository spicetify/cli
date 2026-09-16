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

## Install Spotify on Linux

On x86_64 Linux, the development CLI can install a user-owned Spotify client:

```sh
./target/release/spicetify spotify install
./target/release/spicetify spotify status
./target/release/spicetify spotify update
```

The installer downloads from Spotify's official Debian repository over HTTPS,
checks the package size and SHA256 against the repository metadata, and checks
runtime libraries with `ldd`. Missing libraries must be installed with your
distribution's package manager. Spicetify does not run Debian maintainer scripts
or change system packages.

Installation requires a verified classmap for the exact Spotify version line.
Spicetify patches the candidate before switching its configuration and the
Spotify desktop launcher to it, then restarts Spotify and the daemon. A failed
activation restores the previous configuration and launcher. Previous client
files remain available; the candidate also retains `config-before.toml` and
`desktop-before.desktop` when those files existed.

Client files live under `$XDG_DATA_HOME/spicetify/spotify/versions`, normally
`~/.local/share/spicetify/spotify/versions`. Verified downloads are cached under
`$XDG_CACHE_HOME/spicetify/spotify`. These commands neither replace `/usr/bin/spotify`
nor manage installations owned by apt, pacman, Snap, or Flatpak. The desktop
launcher and Spicetify configuration select the managed client.

Stable is the default channel. Use `spotify install --channel testing` to opt
into Spotify's testing feed, or `spotify update --channel testing` to switch
an existing managed install. Subsequent updates retain that channel. Downgrades
are refused, including when switching back to an older stable release.
An explicit `spotify install` prepares a fresh patched copy even when the
package version is unchanged, so it can restore Spicetify after `spicetify restore`.

Package updates run only when requested. This does not prove that Spotify's
native self-updater is blocked. `spotify status` reports native block detection
separately; an unrecognized endpoint remains **unknown**. The daemon's in-client
**Update & Apply** transaction still uses Spotify's native updater.

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
