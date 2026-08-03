use std::net::{Ipv4Addr, SocketAddr};
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};

pub mod manager;
pub mod process;

pub use manager::{DaemonManager, DaemonManagerError};

const BIND_ADDR: SocketAddr = SocketAddr::new(std::net::IpAddr::V4(Ipv4Addr::LOCALHOST), 7967);

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
pub fn health_check() -> Option<HealthInfo> {
    let client = crate::http::daemon_local_client();
    let resp = client.get(format!("http://{BIND_ADDR}/health")).send().ok()?;
    resp.json().ok()
}

pub fn shutdown_daemon() {
    tracing::info!("Shutting down daemon");
    let client = crate::http::daemon_local_client();
    if let Err(e) = client.post(format!("http://{BIND_ADDR}/shutdown")).send() {
        tracing::warn!(error = %e, "failed to send shutdown request to daemon");
    }
    force_kill_daemon();
}

fn force_kill_daemon() {
    let name = daemon_binary_name();
    tracing::info!("ensuring daemon is stopped");
    crate::process::kill_image(name);
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthInfo {
    pub version: String,
    pub uptime_secs: u64,
    pub apps_watcher_active: bool,
    pub config_watcher_active: bool,
    pub spotify_detected: bool,
}
