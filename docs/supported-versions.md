# supported-versions.json

The allowlist that decides which Spotify versions spicetify will patch.
Shipped in release archives next to the binary, and searched in this order:

1. next to the `spicetify` executable (release installs)
2. the spicetify config folder (package managers, `go install`)

## Schema (version 2)

```json
{
  "schema_version": 2,
  "updated": "2026-07-21",
  "policy": "allowlist",
  "default_map_status": "classic",
  "versions": ["1.2.93"],
  "ranges": [{ "min": "1.2.70", "max": "1.2.94", "note": "..." }],
  "notes": { "1.2.94": "human context" },
  "maps": {
    "1.2.94": {
      "classmap_key": "1020094",
      "status": "modular",
      "note": "verification state of this version's classmap"
    }
  }
}
```

- `schema_version`: 1 (plain allowlist) or 2 (adds `default_map_status`,
  `maps`). Unknown versions are rejected.
- `policy`: only `allowlist`.
- `versions` / `ranges`: inclusive `major.minor.patch` bounds. Normalized
  (`1.2.93.4.gabc` -> `1.2.93`).
- `maps`: optional per-version classmap metadata. `classmap_key` defaults
  to the version encoding (`1.2.94` -> `1020094`); `status` is `classic` |
  `modular` | `none`, defaulting to `default_map_status`. Duplicate
  normalized keys are an error.

## Gate behavior

`backup` and `apply` refuse to run on versions outside the allowlist.
Deliberately:

- **Missing or malformed list fails open** (warn and continue), so
  package-manager installs that cannot ship the file keep working.
- **Undetectable version fails open** (e.g. Linux fresh install with empty
  prefs).
- **The version comes from the install, not prefs**: macOS `Info.plist`,
  Windows exe `ProductVersion`, prefs `app.last-launched-version` only as
  fallback. Prefs lag real updates.
- **`auto` never blocks launch**: unsupported or unknown versions warn and
  start Spotify vanilla.

Inspect any version with `spicetify support [version]`.

Overrides (for developers; the client may break):

- `--force-unsupported-spotify`
- `spotify_version_check=0` in `config-xpui.ini`

## Update control

Two mechanisms complement the gate:

- `spicetify spotify-updates block|unblock`: on macOS, locks the update
  staging directory (`chflags uchg`) and rewrites the update endpoint in
  the Spotify binary (`desktop-update/v2/update` ->
  `desktop-update/no/thanks`, ad-hoc re-signed). Unblock restores the
  original binary from `~/.config/spicetify/spotify-binary-backup`.
  On Windows, the endpoint is patched in `Spotify.exe`. Linux uses the
  package manager.
- `block_spotify_updates=1` (config): every successful `apply` re-asserts
  the block, so the pinned version is self-healing. Opt-in; spicetify never
  disables updates silently for users who did not ask.

## `status: modular` and classmaps

`maps.<version>.status = "modular"` means a verified classmap exists for
that version (`classmaps/<key>/classmap.json`, searched next to the binary
then in the config folder). Only then does the modular apply stage v3
modules at `backup`/`apply` time. See `docs/v3-modules.md`.
