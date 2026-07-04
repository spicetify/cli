use std::net::ToSocketAddrs;
use std::path::{Path, PathBuf};
use std::time::Duration;

pub mod manager;
pub mod process;

pub use manager::{DaemonManager, DaemonManagerError, create as create_manager};

pub const BIND_ADDR: &str = "127.0.0.1:7967";

#[must_use]
pub fn bind_addr() -> std::net::SocketAddr {
    BIND_ADDR.parse().expect("BIND_ADDR is a hard-coded IP:PORT")
}

#[must_use]
pub fn daemon_binary_name() -> &'static str {
    if cfg!(windows) { "spicetify-daemon.exe" } else { "spicetify-daemon" }
}

#[must_use]
pub fn daemon_binary_for(exe: &Path) -> PathBuf {
    let dir = exe.parent().expect("current_exe always has a parent directory");
    dir.join(daemon_binary_name())
}

pub fn daemon_binary_path() -> std::io::Result<PathBuf> {
    Ok(daemon_binary_for(&std::env::current_exe()?))
}

#[must_use]
pub fn is_daemon_running() -> bool {
    let addr = match BIND_ADDR.to_socket_addrs() {
        Ok(mut iter) => match iter.next() {
            Some(a) => a,
            None => return false,
        },
        Err(_) => return false,
    };
    std::net::TcpStream::connect_timeout(&addr, Duration::from_millis(250)).is_ok()
}

#[must_use]
pub fn health_check() -> Option<serde_json::Value> {
    let client =
        reqwest::blocking::Client::builder().timeout(Duration::from_secs(2)).build().ok()?;
    let resp = client.get(format!("http://{BIND_ADDR}/health")).send().ok()?;
    resp.json().ok()
}

pub fn shutdown_daemon() {
    if let Ok(client) = reqwest::blocking::Client::builder().timeout(Duration::from_secs(3)).build()
    {
        let _ = client.post(format!("http://{BIND_ADDR}/shutdown")).send();
    }
    force_kill_daemon();
}

fn force_kill_daemon() {
    let name = daemon_binary_name();
    #[cfg(windows)]
    {
        match std::process::Command::new("taskkill")
            .args(["/F", "/IM", name])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
        {
            Ok(s) if !s.success() => tracing::debug!("taskkill exited with {s}"),
            Err(e) => tracing::warn!(error = %e, "failed to run taskkill"),
            _ => {}
        }
    }
    #[cfg(target_os = "macos")]
    {
        match std::process::Command::new("pkill")
            .args(["-x", name])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
        {
            Ok(s) if !s.success() => tracing::debug!("pkill exited with {s}"),
            Err(e) => tracing::warn!(error = %e, "failed to run pkill"),
            _ => {}
        }
    }
    #[cfg(target_os = "linux")]
    {
        match std::process::Command::new("killall")
            .args(["-q", name])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
        {
            Ok(s) if !s.success() => tracing::debug!("killall exited with {s}"),
            Err(e) => tracing::warn!(error = %e, "failed to run killall"),
            _ => {}
        }
    }
}
