use std::fmt;
#[cfg(unix)]
use std::io;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

#[cfg(unix)]
use rustix::process::{self, Pid, Signal};

use crate::context::AppContext;
use crate::error::{Result, http_error, wrap_error};
use crate::fl;

pub struct SpotifyProc {
    child: Child,
    pgid: u32,
}

impl SpotifyProc {
    pub fn spawn(ctx: &AppContext) -> Result<Self> {
        let exe = &ctx.spotify_exec_path;
        if !exe.is_file() {
            return Err(http_error(400, fl!("invalid-exec-path", path = exe.to_string_lossy())));
        }

        let mut cmd = Command::new(exe);
        let _ = cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());

        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            cmd.pre_exec(|| process::setsid().map(|_| ()).map_err(io::Error::from));
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;

            use windows::Win32::System::Threading::{CREATE_NEW_PROCESS_GROUP, CREATE_NO_WINDOW};
            let _ = cmd.creation_flags((CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP).0);
        }

        let child = cmd.spawn().map_err(|e| {
            wrap_error(anyhow::anyhow!("process spawn failed for {}: {e}", exe.display()), 500)
        })?;
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
            let pid = Pid::from_raw(-(self.pgid as i32)).expect("pgid is non-zero");
            if let Err(e) = process::kill_process(pid, Signal::Term) {
                tracing::debug!("SIGTERM to pgid {} failed: {e}", self.pgid);
            }
        }
        #[cfg(not(unix))]
        {
            let _ = self.pgid;
        }
    }

    fn send_force(&mut self) {
        #[cfg(unix)]
        {
            let pid = Pid::from_raw(-(self.pgid as i32)).expect("pgid is non-zero");
            if let Err(e) = process::kill_process(pid, Signal::Kill) {
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

    /// Enumerate Spotify processes we did **not** spawn (e.g. user opened
    /// Spotify manually from the desktop shortcut). This is the *only* place
    /// enumeration is acceptable — the owned `Child` is always the primary
    /// source of truth.
    #[must_use]
    pub fn find_existing(ctx: &AppContext) -> Vec<OrphanProc> {
        let image = image_name(ctx);
        #[cfg(target_os = "linux")]
        {
            find_existing_linux(&image)
        }
        #[cfg(target_os = "macos")]
        {
            find_existing_macos(&image)
        }
        #[cfg(windows)]
        {
            find_existing_windows(&image)
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

#[derive(Clone, Copy, Debug)]
pub struct OrphanProc {
    pgid: i32,
}

impl OrphanProc {
    #[must_use]
    pub fn new(pgid: i32) -> Self {
        Self { pgid }
    }

    pub fn terminate(&self, grace: Duration) {
        #[cfg(unix)]
        {
            let pid = Pid::from_raw(-self.pgid).expect("orphan pgid is non-zero");
            if let Err(e) = process::kill_process(pid, Signal::Term) {
                tracing::debug!("SIGTERM to orphan pgid {} failed: {e}", self.pgid);
            }
            std::thread::sleep(grace);
            if let Err(e) = process::kill_process(pid, Signal::Kill) {
                tracing::debug!("SIGKILL to orphan pgid {} failed: {e}", self.pgid);
            }
        }
        #[cfg(windows)]
        {
            let _ = self.pgid;
            let _ = grace;
        }
    }
}

fn image_name(ctx: &AppContext) -> String {
    ctx.spotify_exec_path.file_name().and_then(|s| s.to_str()).unwrap_or("Spotify").to_owned()
}

#[cfg(target_os = "linux")]
fn find_existing_linux(image: &str) -> Vec<OrphanProc> {
    let self_pid = std::process::id();
    let mut orphans = Vec::new();

    let Ok(proc_dir) = std::fs::read_dir("/proc") else {
        return orphans;
    };

    for entry in proc_dir.filter_map(|e| e.ok()) {
        let name = entry.file_name();
        let pid: u32 = match name.to_str().and_then(|s| s.parse().ok()) {
            Some(p) => p,
            None => continue,
        };
        if pid == self_pid {
            continue;
        }

        match std::fs::read_to_string(format!("/proc/{pid}/comm")) {
            Ok(comm) if comm.trim() == image => {
                let pgid = read_pgid(pid).unwrap_or(pid as i32);
                orphans.push(OrphanProc::new(pgid));
            }
            _ => {}
        }
    }
    orphans
}

#[cfg(target_os = "linux")]
fn read_pgid(pid: u32) -> Option<i32> {
    let stat = std::fs::read_to_string(format!("/proc/{pid}/stat")).ok()?;
    let after_paren = stat.rsplit_once(')')?.1.trim_start();
    let fields: Vec<&str> = after_paren.split_whitespace().collect();
    fields.get(2)?.parse().ok()
}

#[cfg(target_os = "macos")]
fn find_existing_macos(image: &str) -> Vec<OrphanProc> {
    let mut orphans = Vec::new();
    let output = match Command::new("pgrep").arg("-o").arg(image).output() {
        Ok(o) => o,
        Err(_) => return orphans,
    };
    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let pid: i32 = match line.trim().parse() {
            Ok(p) => p,
            Err(_) => continue,
        };
        let pgid = pgid_of_pid_macos(pid).unwrap_or(pid);
        orphans.push(OrphanProc::new(pgid));
    }
    orphans
}

#[cfg(target_os = "macos")]
fn pgid_of_pid_macos(pid: i32) -> Option<i32> {
    let output = Command::new("ps").args(["-o", "pgid=", "-p", &pid.to_string()]).output().ok()?;
    String::from_utf8_lossy(&output.stdout).trim().parse().ok()
}

// taskkill /f /im Spotify.exe
#[cfg(windows)]
fn find_existing_windows(image: &str) -> Vec<OrphanProc> {
    let orphans = Vec::new();
    let output = match Command::new("taskkill")
        .args(["/F", "/IM", image])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .output()
    {
        Ok(o) => o,
        Err(e) => {
            tracing::warn!("taskkill failed for orphans: {e}");
            return orphans;
        }
    };
    if !output.status.success() {
        tracing::debug!("taskkill found no orphans for {image}");
    }
    orphans
}
