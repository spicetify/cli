use std::fmt;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

#[cfg(unix)]
use rustix::process::{self, Pid, Signal};

use crate::context::AppContext;
use crate::error::Result;
use crate::fl;

pub struct SpotifyProc {
    child: Child,
    #[cfg_attr(not(unix), allow(dead_code))]
    pgid: u32,
}

impl SpotifyProc {
    pub fn spawn(ctx: &AppContext) -> Result<Self> {
        let exe = &ctx.spotify_exec_path;
        if !exe.is_file() {
            return Err(anyhow::anyhow!(fl!("invalid-exec-path", path = exe.to_string_lossy())));
        }

        let mut cmd = Command::new(exe);
        let _ = cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());

        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            let _ = cmd.process_group(0);
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;

            use windows::Win32::System::Threading::{CREATE_NEW_PROCESS_GROUP, CREATE_NO_WINDOW};
            let _ = cmd.creation_flags((CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP).0);
        }

        let child = cmd
            .spawn()
            .map_err(|e| anyhow::anyhow!("process spawn failed for {}: {e}", exe.display()))?;
        let pgid = child.id();

        Ok(Self { child, pgid })
    }

    /// Graceful termination: send process-group `SIGTERM`, wait up to `grace`,
    /// then escalate to `SIGKILL`. On Windows only `TerminateProcess` is used
    /// (no POSIX signalling) and `grace` is slept through before force-kill.
    pub fn terminate(&mut self, grace: Duration) {
        self.send_graceful();
        if self.wait_timeout(grace) {
            return;
        }
        self.send_force();
        let _ = self.wait_timeout(Duration::from_secs(5));
    }

    #[must_use]
    pub fn is_alive(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    #[must_use]
    pub fn pgid(&self) -> u32 {
        self.pgid
    }

    fn send_graceful(&self) {
        #[cfg(unix)]
        {
            let pid = Pid::from_raw(-(self.pgid.cast_signed())).expect("pgid is non-zero");
            if let Err(e) = process::kill_process(pid, Signal::TERM) {
                tracing::debug!("SIGTERM to pgid {} failed: {e}", self.pgid);
            }
        }
        #[cfg(not(unix))]
        {
            let _ = self;
        }
    }

    fn send_force(&mut self) {
        #[cfg(unix)]
        {
            let pid = Pid::from_raw(-(self.pgid.cast_signed())).expect("pgid is non-zero");
            if let Err(e) = process::kill_process(pid, Signal::KILL) {
                tracing::debug!("SIGKILL to pgid {} failed: {e}", self.pgid);
            }
        }
        #[cfg(windows)]
        {
            if let Err(e) = self.child.kill() {
                tracing::debug!("TerminateProcess failed: {e}");
            }
        }
    }

    fn wait_timeout(&mut self, timeout: Duration) -> bool {
        let start = Instant::now();
        let mut delay = Duration::from_millis(100);
        while start.elapsed() < timeout {
            match self.child.try_wait() {
                Ok(Some(_)) => return true,
                Ok(None) => {
                    std::thread::sleep(delay);
                    delay = (delay * 2).min(Duration::from_millis(800));
                }
                Err(e) => {
                    tracing::warn!("error waiting for spotify to exit: {e}");
                    return false;
                }
            }
        }
        false
    }

    pub fn force_kill_orphans(ctx: &AppContext) {
        let image = ctx.spotify_exec_path.file_name().and_then(|s| s.to_str()).unwrap_or("Spotify");

        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .args(["/F", "/IM", image])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
        #[cfg(target_os = "linux")]
        {
            let _ = Command::new("pkill")
                .args(["-x", image])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
        #[cfg(target_os = "macos")]
        {
            let _ = Command::new("pkill")
                .args(["-x", image])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
    }
}

impl Drop for SpotifyProc {
    fn drop(&mut self) {
        self.send_force();
        if let Err(e) = self.child.wait() {
            tracing::debug!("wait on spotify child failed: {e}");
        }
    }
}

impl fmt::Debug for SpotifyProc {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SpotifyProc").field("pgid", &self.pgid).finish_non_exhaustive()
    }
}
