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
`installed_version` and the verified `checksum`.

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

## Runtime module management

The loader exposes a small manager on `Spicetify.Modules`:

```js
Spicetify.Modules.list()              // [{ identifier, version, loaded, mixedIn, failed? }]
Spicetify.Modules.enable("stdlib")    // load one module on demand (deps first)
Spicetify.Modules.disable("stdlib")   // unload with reverse-order dispose
Spicetify.Modules.reload("stdlib")    // disable + enable
Spicetify.Modules.report              // boot report { loaded, failed }
Spicetify.Modules.registry            // the Registry instance
```

Enable runs the full per-module pipeline (preload, css adoption, scheme,
load) for a single module and returns false for unknown, already-loaded, or
dependency-broken identifiers.

## Theme modules

A theme is a module whose primary entry is CSS. The loader:

1. adopts `entries.css` as a stylesheet at load (removed on unload),
2. if the module ships a classic `color.ini`, parses it and sets
   `--spice-<key>` and `--spice-rgb-<key>` on `:root` at load time, exactly
   mirroring the classic pipeline's variable naming, restoring previous
   values on unload.

That makes theme changes and scheme switches runtime operations: no
`backup apply` cycle. `entries.js` remains available for `theme.js`-style
logic with a real lifecycle.

## Platform access

- `Spicetify.Platform` (the classic wrapper API) is fully available.
- stdlib exposes the same object lazily through `src/expose/Platform.ts`,
  answering registry symbol getters on demand.
- stdlib's `wpunpk` surface is a lazy proxy over
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
  stay stale; modules referencing them fail to stage.
- **`dependencies` on remote modules.** The runtime only loads installed
  modules; `pkg install` fetches them at apply time.

## The vault, and where modules come from

A **vault** is a plain JSON registry that `pkg` reads to resolve and
download modules: card data at `modules.<id>.metadata`, releases at
`modules.<id>.v.<version>` (`artifacts[]`, `checksum`, optionally inline
`files` for css-only entries, `hidden` for infrastructure that installs but
never renders a card). `modules.<id>.enabled` pins a version; without it the
highest key wins.

There is exactly one registry, `spicetify/modules/vault.json`, and both the
CLI and the in-client store read it and nothing else. It is built from
per-module sources (`vault/<id>.json`) so a submission touches one reviewable
file, and every entry in it has been through the submission validator: the
artifact downloaded and re-hashed, the card checked against the artifact's own
metadata, published versions immutable, and an id pinned to the account that
first published it. A module's code still lives wherever its author wants;
what is centralised is the index, which is what makes an entry reviewable and
revocable.

Code from outside the registry installs by naming its artifact, which is a
deliberate act rather than a source the CLI consults on its own:

```shell
spicetify pkg install my-module https://example.com/my-module@1.0.0.zip
```

`localStorage["spicetify:defaultVaultUrl"]` repoints the store at another
vault. That is a development lever for previewing a catalog before submitting
it, not a distribution channel: it replaces the registry rather than adding
to it.

## Artifact integrity

Every vault entry carries a `checksum` (`sha256:<hex>`), written by the
publish pipeline and by `spicetify-kit vault add`. Both installers verify it,
because the registry indexes bytes it never wrote and the artifact download
goes through a CORS proxy that is a man in the middle by design.

- **`pkg install`** hashes the download before unpacking. A mismatch aborts
  the install. An entry with no checksum (a local path, or an artifact named
  directly on the command line) installs with a warning that prints the digest
  it got, which is the only thing a user can compare against.
- **The in-client store** does the same, with the result on the install
  status line.

`artifacts` is a list in preference order: the author's host first, then this
org's mirror of the same bytes. Both installers walk it, so a release asset
that later disappears costs an attempt rather than every install of that
version. Whichever host answers, the checksum is the same.

## The full flow

```
module source (MAP.*)
        |
        |   stitch (rolldown, MAP-intact)
        v
  RemapClassmapReferences (at apply, per installed classmap)
        |
        staged into xpui
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

## Building modules (stitch)

Modules are built with `stitch` in the modules repo (`scripts/stitch.ts`),
a thin builder on rolldown. Node 24, no Deno required, TypeScript native:

```shell
pnpm stitch modules/stdlib        # auto-detects the classmap
pnpm stitch --classmap 1020092    # or pass a key/path explicitly
```

- Bundles TS/TSX with rolldown (lazy chunks preserved, `https://`
  imports external).
- Compiles `index.scss` to `index.css`.
- Emits `dist/<name>@<version>/` with `metadata.json` and the
  `spicetify-module.json` sidecar.
- Optionally generates `classmap.d.ts` (typed `MAP`) when `CLASSMAP_JSON`
  points at a classmap.

Built modules are MAP-intact: `MAP.*` references survive into the bundle
and are remapped at apply time by the CLI. One build serves every supported
Spotify version.

### Why Node and not Deno

The 2024 prototype was Deno-first (TS-native execution, JSR, web-standard
APIs). Nothing in the current pipeline needs it anymore: Node 24 strips
types natively, rolldown bundles TS, and the rest of spicetify (the CLI
wrapper, build scripts) is Node-based. The tailor-based Deno tasks remain
in the modules repo for reference only.
