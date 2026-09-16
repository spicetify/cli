# Windows Update & Apply verification, 2026-09-16

The Windows desktop update transaction was exercised from Manager against a
real Spotify installation. It downloaded and installed Spotify, reapplied
Spicetify, and restored update protection. **The transaction passed; direct
inspection of its first patched boot remains incomplete.** Native captures
returned blank images, but the same captures were also blank when CDP proved
the renderer and all six modules were healthy. This does not establish a
Spotify launch failure. Windows remains disabled in release builds.

The user subsequently confirmed that Spotify displays normally. That confirms
the final user-visible state after the diagnostic restart, not the first
automatic restart.

## Setup and local substitutions

- Windows desktop Spotify, not Microsoft Store: 1.2.98.301 to 1.3.0.277.
- CLI source based on `923fa98`, version 3.0.0-beta.17, with matching local
  CLI/daemon binaries and a freshly built embedded payload.
- Build the daemon experiment with
  `cargo build --release -p cli -p daemon --features daemon/experimental-windows-updates`.
  This feature is off by default and does not enable Linux.
- Started through Spotify profile menu, Spicetify Settings, Open Module
  Manager, Update & Apply, and its restart confirmation. No installer was
  manually downloaded or launched.
- The first stalled attempt was deliberately aborted by sending the renderer
  failure event to the daemon. This tested recovery; it was not a spontaneous
  Spotify error.
- After the second job completed, a manual restart with CDP enabled was used
  to investigate the blank native capture. Module health was verified after
  that restart, not on the first automatically patched boot.

## Findings and fixes

1. Admission opened the running executable for writing. Windows rejects that
   access. Modern Windows protection changes the staging-folder ACL, so the
   preflight now checks that protection path and the writable Apps tree without
   opening the executable for writing. A regression holds the executable open
   without write sharing and verifies admission's preflight succeeds.
2. Removing staging-folder protection does not stop Spotify. The transaction
   previously called `start`, which leaves an existing process running. No
   update was offered. The Windows transaction now explicitly restarts Spotify
   after opening the temporary update window.
3. A process and a correct manifest do not prove a working renderer. Native
   capture and UI Automation did not expose the first patched renderer. Both
   ordinary apply and manual launches produced the same blank native captures;
   a debugging-enabled launch simultaneously produced a healthy CDP screenshot
   and a blank native capture. The initial inference of a boot failure was
   withdrawn. Do not classify Windows as fully verified from this partial UI pass.

## Observed transaction

Times are UTC. The second attempt retained job
`18d5c3f383ca758c-762c` through every phase.

| Time | Observation |
| --- | --- |
| 09:44:37 | Manager admission accepted from 1.2.98 |
| 09:44:38–39 | Updates temporarily allowed; Spotify stopped and restarted |
| 09:44:45 | Spotify offered 1.3.0.277; download acknowledged |
| 09:44:54 | Renderer acknowledged installation |
| 09:45:03 | Installed version advanced; daemon began apply |
| 09:45:09 | Apply finished and Spotify launched |
| 09:45:10 | Block verified; daemon reported complete |

The post-update manifest reports `spotifyVersion: 1.3.0`, classmap `1030000`,
`classmapVerified: true`, and `updatesBlocked: true`. The executable reports
1.3.0.277 and Spotify.dll retains a valid signature. Daemon startup registration
was restored. The first attempt also reached `failed-safe` with protection
restored after its controlled abort.

Local evidence is under the workspace's
`scratchpad/windows-update-verification/`: transaction log, state transitions,
before/after manifests, blank native captures, and a healthy CDP capture.
These files are local diagnostic artifacts, not release fixtures.

## Remaining verification

The later [daemon Apply verification](daemon-apply-verification.md) diagnoses
and fixes a separate self-shutdown path seen during an ordinary in-client
Apply. Its authenticated RPC run passed, but it does not replace the missing
first-boot visual check below.

Repeat an actual version update with reliable first-boot observation and
without a diagnostic restart. Check loaded modules through the normal UI before
calling the job's user outcome complete. Microsoft Store installations, Linux,
interrupted installer recovery, and natural timeout recovery were not tested.
