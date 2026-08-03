use anyhow::Context;

use crate::error::Result;
use crate::fl;

pub(crate) fn start() -> Result<()> {
    crate::daemon::process::spawn().with_context(|| fl!("failed-spawn-daemon"))?;
    tracing::info!("{}", fl!("daemon-starting"));
    Ok(())
}

#[allow(clippy::unnecessary_wraps)]
pub(crate) fn stop() -> Result<()> {
    crate::daemon::shutdown_daemon();
    tracing::info!("{}", fl!("daemon-stopping-resp"));
    Ok(())
}

#[allow(clippy::unnecessary_wraps)]
pub(crate) fn uninstall() -> Result<()> {
    crate::daemon::DaemonManager::create().uninstall();
    Ok(())
}

pub(crate) fn install() -> Result<()> {
    crate::daemon::DaemonManager::create().install().map_err(Into::into)
}

#[allow(clippy::unnecessary_wraps)]
pub(crate) fn status() -> Result<()> {
    let running = crate::daemon::is_daemon_running();
    let installed = crate::daemon::DaemonManager::create().is_installed();

    if running {
        let addr = crate::daemon::bind_addr().to_string();
        tracing::info!("{}", fl!("daemon-running", addr = addr));
        if let Some(health) = crate::daemon::health_check() {
            tracing::info!("{}", fl!("daemon-status-version", version = health.version));
            tracing::info!(
                "{}",
                fl!("daemon-status-uptime", uptime = health.uptime_secs.to_string())
            );
            tracing::info!(
                "{}",
                fl!("daemon-status-spotify", detected = health.spotify_detected.to_string())
            );
        }
    } else {
        tracing::info!("{}", fl!("daemon-not-running-status"));
    }

    if installed {
        tracing::info!("{}", fl!("daemon-auto-start-enabled"));
    } else {
        tracing::info!("{}", fl!("daemon-auto-start-disabled"));
    }
    Ok(())
}
