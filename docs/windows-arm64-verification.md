# Windows ARM64 installation verification, September 29, 2026

The installer selects a matching CLI and daemon for native ARM64 Spotify and
preserves x64 Spotify installations on ARM64 Windows. The native Windows
installation and daemon recovery checks passed with a local release package.
Published ARM64 release downloads remain unverified.

## Environment and artifacts

The native runtime checks used this configuration:

- Windows 11 Pro ARM64, build 26100, in VMware Fusion.
- Desktop Spotify 1.3.1.234, executable machine `0xAA64`.
- Source `2409117615efa9c82341c5aadac6753a60122ee4`, based on beta.19
  (`b50800b2d225ca4cc09d83b9e785723c88b9d8af`).
- Rust 1.98.1, native ARM64 MSVC toolchain, Visual Studio Build Tools
  17.14.41, MSVC 14.44.35207, and clang-cl 19.1.5.
- Optimized CLI and daemon built together after rebuilding the embedded payload.
- Installed CLI: `C:\Users\test\AppData\Local\spicetify\spicetify.exe`.
- Both installed binaries have PE machine `0xAA64` and report beta.19.
  The running daemon version was read from `/health`.

The installed CLI SHA256 is
`A66F66D9CE6515D4835BAC5411D75A83ACED2273CAC739120E1277F0F6D9A0E4`.
The daemon SHA256 is
`452D5AEAC67E5DFF80D4DAD28BB54C7E52B3CEE92D5B1F3A2B8E53E21BF23FD5`.
These are local builds, not published beta.19 assets.

## Installation and lifecycle results

The full installer ran in the regular interactive desktop session. Only the
release archive and checksum responses were replaced with local fixtures.
Checksum verification, extraction, architecture selection, daemon shutdown,
binary replacement, shell completion, and Apply ran through the installer.

| Check | Result |
| --- | --- |
| Native Windows PowerShell 5.1 and 32-bit PowerShell | ARM64 host detected in both; installer regression tests passed |
| Native Spotify | Selected ARM64; installed pair hashes match the optimized build |
| Configured x64 executable fixture | Actual staged ARM64 CLI selected x64; installer fetched the same version's x64 archive and installed both matching binaries |
| Store alias fixture | Unreadable-as-PE alias fell back to the configured data directory's real x64 executable |
| Missing second binary during replacement | Original CLI and daemon restored |
| Locked installed CLI | Replacement rejected; original pair preserved |
| Invalid download checksum | Installation rejected before replacing binaries |
| Enabled daemon stopped before same-version self-update | Real `self-update` restarted it and preserved HKCU Run registration |
| Intentionally disabled daemon | Real `self-update` left it stopped and unregistered |
| Final Apply | Restored normal autostart and URL registration; Spotify restarted normally |

Installer replacement changed the interactive daemon from PID 1904 to 7460.
After the stop/recovery tests and final Apply, PID 4712 ran in session 2 with
both watchers active. The HKCU Run entry points to the installed daemon;
`spicetify://` points to the installed CLI.

Native caption buttons were hidden in the running client. The subsequent
visual pass found that the module still reserved space at the right edge on
Spotify 1.3.1. That CSS selector issue belongs to the modules repository and is
separate from native helper architecture compatibility.

## Build checks and remaining coverage

The macOS workspace suite passed 180 tests, with three ignored. The repository's
CI lint command, `cargo clippy --workspace --locked -- -D warnings`, passed.
A broader `--all-targets` lint run reports test-only lint failures and does not
pass. Nine native Windows update tests and the optimized CLI/daemon build
passed. The ARM64 setup script successfully exported MSVC build variables and
selected the native Rust host in the VM.

The live VM retained a local CSS-map override for the independent fallback
styling fix. Spotify 1.3.1 used the published 1.3.0 classmap fallback. These
substitutions do not establish full classmap compatibility.

The x64 compatibility checks use real x64 PE binaries as fixtures; an actual
x64 Spotify installation was not run. The same-version release-selection test
covers architecture migration, but a complete old published x64 updater to new
published ARM64 release transaction still requires the release assets to exist.
Hosted ARM64 CI and release packaging must pass before release readiness can be
claimed. This work does not enable experimental Windows Spotify updates.
