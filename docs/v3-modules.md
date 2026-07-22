# V3 module authoring

How modules work in the v3 modular runtime: the package format, the classmap
remap, the runtime lifecycle, and what does and does not work today.

## Package layout

A module is a folder in the spicetify config folder (`Modules/<identifier>/`)
or a `pkg` artifact, with a `metadata.json`:

```json
{
  "name": "my-module",
  "tags": ["dev"],
  "version": "0.1.0",
  "authors": ["you"],
  "description": "What it does",
  "entries": { "js": "index.js", "css": "index.css" },
  "hasMixins": false,
  "dependencies": { "stdlib": "^0.2.0" }
}
```

Rules: `version` is required (semver), at least one of `entries.js` /
`entries.css`, and `dependencies` maps module identifiers to semver ranges
(also accepts an empty array for none, for compatibility with 2024 metadata).
A `spicetify-module.json` sidecar is added by `spicetify pkg install` with
`installed_version`, `classmap_base`, and `allow_stale`.

## Class references (`MAP.*`)

Modules never hardcode Spotify's hashed classes. Reference the classmap
instead:

```tsx
<button className={MAP.main.playbar.buttons.button.wrapper} />
const active = { [MAP.main.playbar.buttons.button.wrapper__active]: isActive };
```

At apply time, `MAP.*` references resolve against the installed client's
classmap (`RemapClassmapReferences`):

- A path that resolves to a leaf becomes a quoted class literal.
- A path that is missing or marked stale in the target classmap fails the
  whole module. Skipped modules are reported, never silently broken.

Pre-tailored artifacts (built for an older classmap, version suffix
`+cm-<key>`) are retargeted instead: every leaf hash of the build classmap is
rewritten to the leaf at the same path in the target classmap, strict by
default. `pkg install --allow-stale` keeps old hashes for retired paths.

## Runtime lifecycle

`entries.js` is an ES module exporting any of:

```ts
export async function mixin(transformer, ctx) {}   // before the client boots
export async function preload(ctx) {}              // before load
export async function load(ctx) {}                 // main body
```

- `mixin` runs before the client bundle executes; use it for interceptions
  that must exist before boot. It receives a `transformer` factory (see
  below) and a context `{ spotifyVersion }`.
- `preload` and `load` run after the client is up, in dependency order.
  Either may return a dispose function, called on unload.
- `entries.css` is adopted as a stylesheet between preload and load and
  removed on unload.

Modules load in dependency order and fail independently: one broken module
never blocks the rest. `Spicetify.Modules.report` in the console shows what
loaded and why anything failed.

## Platform access

- `Spicetify.Platform` (the classic wrapper API) is fully available.
- hooks-era `src/expose/Platform.js` is bridged: it resolves
  `Spicetify._platform` lazily and answers registry symbol getters on demand.
- `src/wpunpk.mix.js` is bridged to a lazy proxy over
  `globalThis.__webpack_require__`, which the loader captures after the
  client is up. `webpackRequire.m` and `webpackRequire(id)` work.

## What does not work (today)

- **Source transforms are opt-in.** `transformer(fn, { glob })`
  registrations are collected, but application to the bundle is disabled by
  default (`__SPICETIFY_APPLY_TRANSFORMS__` experiments only). Transforms
  that close over module imports cannot run offthread at all. Features that
  depend on source rewriting degrade.
- **wpunpk's array trap is degraded.** The `rspackChunkclient_web`
  push/forEach trap is ported for compatibility, not fidelity.
- **Retired classmap paths.** Paths that no longer exist in the client
  (currently: topbar icon wrapper, upgrade button, settings text input)
  stay stale; modules referencing them fail unless installed with
  `--allow-stale`.
- **`dependencies` on remote modules.** The runtime only loads installed
  modules; `pkg install` fetches them at apply time.

## The full flow

```
module source (MAP.*)          or   pre-tailored artifact (+cm-1020040)
        |                                  |
        v                                  v
  RemapClassmapReferences        RetargetClassmapHashes
        |                                  |
        +-------- staged into xpui --------+
                     |
        preprocess (css-map overlay merged)
                     |
        apply (loader tag + manifest + compat shims)
                     |
   client boot: loader -> mixins -> ordered bundle
   injection -> capture require -> preload/css/load
```

Supported Spotify versions only: staging runs only when the installed
version has `status: modular` in `supported-versions.json` and its classmap
is present.
