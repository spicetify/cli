# Daemon-owned Apply verification, 2026-09-16

Applying from the client could stop the daemon permanently and disable its
autostart entry. Hide Window Controls then reported that the service was
unavailable. Restarting the daemon recovered that module without reopening
Spotify.

The RPC handler ran synchronous commands on the daemon's single async thread.
Apply's request to its own health endpoint timed out, so Apply treated the
daemon's version as unknown, unregistered it, and killed its own process.
Daemon-owned Apply could also register `spicetify-daemon` as the URL handler,
although that executable does not implement CLI protocol commands.

RPC commands now execute on blocking workers. Explicit Apply modes keep daemon
maintenance and URL registration in the foreground CLI. RPC Apply, watcher
repairs, and the update transaction preserve their owning daemon. Blocking
workers are no longer limited to one, so a watcher waiting for Spotify to exit
does not prevent RPC commands from reaching the operation guard.

## Automated checks

- A regression holds the Apply file lock while dispatching a real Apply RPC.
  The old handler stalled the async runtime for five seconds and failed. The
  fixed handler kept it responsive and passed in 0.06 seconds. The fixture
  refuses a foreign apply before any real Spotify operation.
- `cargo +1.95.0 test --workspace --locked --features daemon/native-window-controls-tests`:
  142 passed, three existing tests requiring real bundles or registry downloads ignored.
- `cargo +1.95.0 clippy --workspace --locked -- -D warnings`: passed.
  A pre-existing TUI Backspace match required a behavior-preserving lint fix.
- An additional `--all-targets` Clippy scan found existing test-only warnings
  outside this regression. That broader scan is not the repository CI command
  and is not reported as passing.
- Matching release CLI/daemon binaries were built with the current payload.

## Windows live run

The patched pair was installed in the normal local installation directory,
with backups retained. Both still identify as 3.0.0-beta.17; this is a local
build, not a published release. The existing daemon was explicitly restarted
before testing because its version alone cannot distinguish local builds.

An authenticated `spicetify:0:apply` request completed against Spotify desktop
1.3.0.277. This used the same RPC as the client but was sent by a diagnostic
script, **not clicked in the UI**.

- All 109 concurrent health requests succeeded; maximum latency was 17 ms.
- Daemon PID 28012 survived the operation, with monotonically increasing uptime.
- Apply finished and automatically launched Spotify, which exposed a window
  titled `Spotify Free`.
- Autostart stayed enabled and the URL handler still targeted `spicetify.exe`.
- No daemon restart or registration mutation appeared in the Apply log.
- Spotify updates remained blocked.

Evidence is retained locally under the workspace's
`scratchpad/daemon-owned-apply/`. It is not a release fixture.

## End-user coverage and remaining limits

Before installing this fix, native Computer Use verified the profile-menu
settings route, Manager's six loaded modules, playback, elapsed-time rendering,
and recovery of hidden window controls after restarting the stopped daemon.

The native bridge subsequently became unavailable in the current host session.
Both a fresh connection and a session reset returned `native pipe unavailable`.
Consequently the fixed build's automatic launch was verified as a process and
window, not visually inspected. The normal UI Apply action and the first
patched renderer after an actual Spotify version update still need a native
end-user pass. The earlier [Windows update report](windows-update-verification.md)
remains accurate; this run does not clear its first-boot limitation or enable
Windows Update & Apply in release builds.
