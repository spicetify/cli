use std::process::{Command, Stdio};
use std::time::Duration;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum DaemonSpawnError {
    #[error("failed to locate daemon binary: {0}")]
    BinaryNotFound(String),

    #[error("io error spawning daemon: {0}")]
    Io(#[from] std::io::Error),

    #[error("daemon exited immediately with status {0}")]
    Exited(std::process::ExitStatus),
}

const DAEMON_START_TIMEOUT: Duration = Duration::from_secs(5);

pub fn spawn() -> Result<(), DaemonSpawnError> {
    if super::is_daemon_running() {
        return Ok(());
    }
    let exe = super::daemon_binary_path()?;
    let mut cmd = Command::new(&exe);
    let _ = cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;

        use windows::Win32::System::Threading::{CREATE_NEW_PROCESS_GROUP, CREATE_NO_WINDOW};
        let _ = cmd.creation_flags((CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP).0);
    }
    let mut child = cmd.spawn()?;

    let addr = super::bind_addr();
    let deadline = std::time::Instant::now() + DAEMON_START_TIMEOUT;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Err(DaemonSpawnError::Exited(status)),
            Err(e) => return Err(DaemonSpawnError::Io(e)),
            _ => {}
        }
        if std::net::TcpStream::connect_timeout(&addr, Duration::from_millis(100)).is_ok() {
            return Ok(());
        }
        if std::time::Instant::now() >= deadline {
            if let Err(e) = child.kill() {
                tracing::warn!(error = %e, "failed to kill daemon process after startup timeout");
            }
            if let Err(e) = child.wait() {
                tracing::warn!(error = %e, "failed to wait for daemon process after kill");
            }
            return Err(DaemonSpawnError::Io(std::io::Error::other(format!(
                "daemon did not start listening within {} seconds",
                DAEMON_START_TIMEOUT.as_secs(),
            ))));
        }
    }
}
