# Spotify version support

Spicetify v3 derives Spotify support from the published classmaps index. A new
verified classmap can support a Spotify release without requiring a new CLI
release.

## Source of truth

[`spicetify/classmaps`](https://github.com/spicetify/classmaps) publishes
`index.json`. Each entry binds a Spotify `major.minor.patch` version to these
files and their SHA-256 digests:

- A classmap that maps stable module names to the client's hashed classes.
- An optional CSS-map overlay for classes that changed in that Spotify build.
- `META.json`, which records the verification status and evidence.

`apply` downloads the index and required files into
`<config>/classmaps/`. It rejects files whose digest does not match the index.
A failed refresh is not fatal when a usable cached classmap remains, so an
already-supported client can still apply offline.

The availability feed at `spicetify/modules/spotify-support.json` has a
different job. It records the newest Spotify release the project has observed.
It does not declare support and must not gate an update by itself.

## Refresh a newly published fix

If a published compatibility fix has not reached your client after a normal
apply, run:

```sh
spicetify apply --no-cache
```

This option is available in v3 builds whose `spicetify apply --help` lists
`--no-cache`. It bypasses local file reuse and CDN caches for the classmap
index, selected classmap, CSS-map overlay, verification metadata, and exposure
patches. Downloaded compatibility files must still match the index's SHA-256
digests. New verified files are saved for later normal and offline applies.

The refresh requires network access. If a download fails or its checksum does
not match, the command exits before stopping or changing Spotify. Retry when
the network or published files are available. A normal `spicetify apply`
continues to allow cached files when a refresh fails.

After a successful apply, return to the restarted Spotify client and check the
fixed control. This command refreshes compatibility data; update a theme or
module through the Store separately if the fix also requires a new version.
It does not clear Spotify's music cache or update Spotify or the CLI.

`SPICETIFY_CLASSMAPS_DIR` selects local files instead of downloading them, so
combining it with `--no-cache` is an error. Unset it to fetch published files.
Other explicit local CSS-map and exposure-patch overrides still take priority;
unset those too when verifying a published fix.

## Classmap selection

The key encodes `major.minor.patch`. For example, Spotify `1.3.0.277` uses
`1030000`; the fourth build component does not affect compatibility.

Selection follows these rules:

1. Use the exact published key when it exists.
2. Otherwise, use the newest lower patch in the same `major.minor` release.
3. Never fall back across a minor release.

A patch fallback logs a warning and writes `classmapFallback: true` to the
module manifest. A Spotify release with no exact or same-minor classmap fails
staging instead of silently applying unrelated hashes.

`apply` also rejects Spotify releases older than `1.2.80` before it stops or
modifies the client.

## Manifest support fields

`apply` writes support provenance to `modules/manifest.json`:

- `spotifyVersion` is the installed Spotify version.
- `classmapKey` is the selected classmap key.
- `classmapSpotify` is the Spotify version against which the selected map was
  verified.
- `classmapVerified` is true only when the selected classmap and `META.json`
  match a verified entry in the consumed index.
- `supportedSpotify` is the newest verified Spotify version in that index.
- `classmapFallback` reports whether selection used an older patch.
- `updatesBlocked` reports the installed updater protection at apply time.

Manager combines these local facts with the availability feed. Its
**supported** badge comes from `supportedSpotify`; its **available** badge
comes from the observed-version feed.

## Update admission

One-step **Update & Apply** is enabled by default only on macOS. The daemon
advertises this capability through `/health`, and admission rejects other
platforms before it writes job state or changes updater protection.

Windows has an opt-in local build feature for verification. Its live update
transaction passed, but first-boot UI verification remains incomplete; see
[the Windows verification record](windows-update-verification.md). Release
builds keep this feature disabled.

On macOS, admission requires a verified `supportedSpotify` version newer than
the installed version. Spotify's exact updater offer is authoritative. The
daemon rejects any offer that is not newer than the installed version or is
newer than the verified support ceiling.

The renderer must also expose all of `Platform.UpdateAPI.subscribe`,
`prepareUpdate`, and `applyUpdate`. A partial API fails closed before it admits
a daemon job.

If recovery cannot prove that Spotify is blocked again, the daemon retries for
two minutes. It then releases the operation lock and tells the user to run
`spicetify spotify-updates block`. The public terminal state keeps the existing
`securing` wire kind with `manualRecovery: true` so older Manager modules still
show the recovery command.

## Manual update controls

These commands remain available on supported native Spotify installations:

```sh
spicetify spotify-updates block
spicetify spotify-updates unblock
spicetify spotify-updates status
```

Current Windows clients protect the updater staging directory. macOS and Linux
patch the update endpoint in Spotify's binary; macOS also signs the changed app
bundle and applies a secondary update-cache lock.

`block` and `unblock` store the user's intent in `config.toml`. A successful
Spotify update can replace the installed protection, so `apply` reasserts a
remembered block.

## Developer overrides

Use these environment variables only for local verification:

- `SPICETIFY_CLASSMAPS_DIR` selects a local classmaps root and skips fetching.
- `SPICETIFY_CLASSMAPS_URL` changes the published index origin.
- `SPICETIFY_CSS_MAP` selects a CSS map file or directory.
- `SPICETIFY_EXPOSE_PATCHES` selects a local exposure-patch file.
