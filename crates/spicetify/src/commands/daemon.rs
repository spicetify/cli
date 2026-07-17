use crate::error::Result;
use crate::fl;

pub(crate) fn start() {
    if let Err(e) = crate::daemon::process::spawn() {
        tracing::warn!(error = %e, "{}", fl!("failed-spawn-daemon"));
    } else {
        tracing::info!("{}", fl!("daemon-starting"));
    }
}

pub(crate) fn stop() {
    crate::daemon::shutdown_daemon();
    tracing::info!("{}", fl!("daemon-stopping-resp"));
}

pub(crate) fn install() -> Result<()> {
    Ok(crate::daemon::DaemonManager::create().install()?)
}

pub(crate) fn uninstall() -> Result<()> {
    Ok(crate::daemon::DaemonManager::create().uninstall()?)
}

pub(crate) fn status() {
    let running = crate::daemon::is_daemon_running();
    let installed = crate::daemon::DaemonManager::create().is_installed();

    if running {
        let addr = crate::daemon::bind_addr().to_string();
        tracing::info!("{}", fl!("daemon-running", addr = addr));
        if let Some(health) = crate::daemon::health_check() {
            if let Some(ver) = health.get("version").and_then(|v| v.as_str()) {
                tracing::info!("{}", fl!("daemon-status-version", version = ver.to_string()));
            }
            if let Some(uptime) = health.get("uptime_secs").and_then(serde_json::Value::as_u64) {
                tracing::info!("{}", fl!("daemon-status-uptime", uptime = uptime.to_string()));
            }
            if let Some(spotify) =
                health.get("spotify_detected").and_then(serde_json::Value::as_bool)
            {
                tracing::info!("{}", fl!("daemon-status-spotify", detected = spotify.to_string()));
            }
        }
    } else {
        tracing::info!("{}", fl!("daemon-not-running-status"));
    }

    if installed {
        tracing::info!("{}", fl!("daemon-auto-start-enabled"));
    } else {
        tracing::info!("{}", fl!("daemon-auto-start-disabled"));
    }
}
