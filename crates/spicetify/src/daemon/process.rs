use std::process::{Command, Stdio};
use std::time::Duration;

use thiserror::Error;

use crate::context::AppContext;

const CONFIG_ROOT_ENV: &str = "SPICETIFY_CONFIG_ROOT";

#[derive(Debug, Error)]
pub enum DaemonSpawnError {
    #[error("failed to locate daemon binary: {0}")]
    BinaryNotFound(String),

    #[error("io error spawning daemon: {0}")]
    Io(#[from] std::io::Error),

    #[error("daemon exited immediately with status {0}")]
    Exited(std::process::ExitStatus),
}

pub fn spawn(ctx: &AppContext) -> Result<(), DaemonSpawnError> {
    if super::is_daemon_running() {
        return Ok(());
    }
    let exe = super::daemon_binary_path()?;
    let mut cmd = Command::new(&exe);
    let _ = cmd
        .env(CONFIG_ROOT_ENV, &ctx.config_root)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;

        use windows::Win32::System::Threading::{CREATE_NEW_PROCESS_GROUP, CREATE_NO_WINDOW};
        let _ = cmd.creation_flags((CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP).0);
    }
    let mut child = cmd.spawn()?;

    let addr = super::bind_addr();
    let deadline = std::time::Instant::now() + Duration::from_secs(5);
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
            let _ = child.kill();
            let _ = child.wait();
            return Err(DaemonSpawnError::Io(std::io::Error::new(
                std::io::ErrorKind::TimedOut,
                "daemon did not start listening within 5 seconds",
            )));
        }
    }
}
