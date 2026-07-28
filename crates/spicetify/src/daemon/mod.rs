use std::net::{Ipv4Addr, SocketAddr};
use std::path::{Path, PathBuf};
use std::time::Duration;

pub mod manager;
pub mod process;

pub use manager::{DaemonManager, DaemonManagerError};

const BIND_ADDR: SocketAddr = SocketAddr::new(std::net::IpAddr::V4(Ipv4Addr::LOCALHOST), 7967);
const BIND_ADDR_STR: &str = "127.0.0.1:7967";

#[must_use]
pub fn bind_addr() -> SocketAddr {
    BIND_ADDR
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
    std::net::TcpStream::connect_timeout(&BIND_ADDR, Duration::from_millis(250)).is_ok()
}

#[must_use]
pub fn health_check() -> Option<serde_json::Value> {
    let client =
        reqwest::blocking::Client::builder().timeout(Duration::from_secs(2)).build().ok()?;
    let resp = client.get(format!("http://{BIND_ADDR_STR}/health")).send().ok()?;
    resp.json().ok()
}

pub fn shutdown_daemon() {
    tracing::info!("Shutting down daemon");
    if let Ok(client) = reqwest::blocking::Client::builder().timeout(Duration::from_secs(3)).build()
        && let Err(e) = client.post(format!("http://{BIND_ADDR_STR}/shutdown")).send()
    {
        tracing::warn!(error = %e, "failed to send shutdown request to daemon");
    }
    force_kill_daemon();
}

fn force_kill_daemon() {
    let name = daemon_binary_name();
    tracing::info!("ensuring daemon is stopped");
    crate::process::kill_image(name);
}
