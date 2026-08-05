# v3

Spicetify v3 monorepo — a customization framework for the Spotify desktop client.

## Installation (windows only)

> A previous Spicetify v2 installation should be removed or backed up first.

Download the latest installer from [releases](https://github.com/veryboringhwl/app/releases) (`installer-<version>-windows-x64.exe`) and run it.

```sh
spicetify apply
spicetify sync
```

Then extract and run these commands in powershell:

```sh
cd modules
deno task fetch
deno task build
deno task enable
```

## Building from Source

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Deno](https://deno.com/)
- Spotify desktop client `1.2.86` or newer

### 1. App

```sh
cd app && cargo build --release
```

Copy the binary to your Spicetify bin directory:

| Platform      | Path                                         |
| ------------- | -------------------------------------------- |
| Windows       | `%LOCALAPPDATA%\Spicetify\bin\spicetify.exe` |
| macOS / Linux | `~/.config/spicetify/bin/spicetify`          |

### 2. Initialize

```sh
spicetify init
```

### 3. Hooks

Windows only

```sh
cd hooks && deno task test
```

Output is written to your Spicetify config directory under `hooks/`.

### 4. Modules

```sh
cd modules
deno task fetch
deno task build
deno task enable
```

To install a module directly from a prebuilt artifact without building from source:

```
spicetify:0:fast-enable?id=marketplace@0.0.1&artifacts=https%3A%2F%2Fgithub.com%2FDelusoire%2Fbespoke-modules%2Freleases%2Fdownload%2F2024-08-29%2FDelusoire.marketplace%400.1.3%2Bcm-1020040-ly32efah.zip
```
