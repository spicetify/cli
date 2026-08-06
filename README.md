<h3 align="center"><a href="https://spicetify.app/"><img src="https://i.imgur.com/iwcLITQ.png" width="600px"></a></h3>
<p align="center">
  <a href="https://goreportcard.com/report/github.com/spicetify/cli"><img src="https://goreportcard.com/badge/github.com/spicetify/cli"></a>
  <a href="https://github.com/spicetify/cli/releases/latest"><img src="https://img.shields.io/github/release/spicetify/cli/all.svg?colorB=97CA00&label=latest%20version"></a>
  <a href="https://github.com/spicetify/cli/releases"><img src="https://img.shields.io/github/downloads/spicetify/cli/total.svg?colorB=97CA00&label=total%20downloads"></a>
  <a href="https://discord.gg/VnevqPp2Rr"><img src="https://img.shields.io/discord/842219447716151306?label=chat&logo=discord&logoColor=discord"></a>
</p>

---

Command-line tool to customize the official Spotify client.
Supports Windows, MacOS and Linux.

<img src=".github/assets/logo.png" alt="img" align="right" width="560px" height="400px">

### Features

- Change colors across the User Interface
- Inject CSS for advanced customization
- Inject Extensions to extend functionalities, manipulate UI and control player
- Inject Custom Apps
- Make yourself in control of the Spotify client

### Links

- [Installation](https://spicetify.app/docs/getting-started)
- [Basic Usage](https://spicetify.app/docs/getting-started#basic-usage)

---

### v3: the Rust CLI (in progress, `rust/`)

The v3 CLI is being rebuilt in Rust on the foundation of
[veryboringhwl/app](https://github.com/veryboringhwl/app) (MIT), imported with
its history preserved. **The Go CLI remains the released and default binary on
every platform**; there is no v3 release yet, so `install.sh --v3` has nothing
to fetch until the first tag lands.

v3 is a different model rather than a faster v2, so upgrading is a reinstall:

- **Modules replace extensions, custom apps and themes.** One package format
  with a manifest and declared dependencies, mounted through named surfaces
  (nav links, top-bar and playbar buttons, routes, panels, menus, settings
  sections) instead of hand-written selectors.
- **A store inside the client**, and `spicetify pkg` outside it. Installed
  versions are kept side by side, so reverting a bad update is enabling the
  previous one. Community catalogs beyond the default one must be trusted
  explicitly, and only over HTTPS.
- **Classmaps decouple modules from Spotify's hashed class names**, fetched and
  sha256-verified per apply, so a new Spotify build needs a published classmap
  rather than a CLI release. A missing one falls back to the nearest lower
  build within the same Spotify minor instead of breaking.
- **Extract-and-serve apply.** The client is served from a patched directory
  rather than a repacked archive, so staging a module does not rebuild the app.
- **An optional daemon** that re-applies after Spotify updates itself, proxies
  requests the client cannot make directly, and exposes the CLI to the client:
  a module can trigger an apply or change Spotify's update policy through
  `Spicetify.Daemon` instead of asking the user to open a terminal. It is
  token-gated, and the client falls back to showing the command when the
  daemon is not running.

---

### Acknowledgements

- [veryboringhwl](https://github.com/veryboringhwl) — author of the Rust app
  the `rust/` workspace is founded on (extract-and-serve apply model,
  versioned payload sets, update watcher, protocol handler, TUI).

### Code Signing Policy

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org/).
