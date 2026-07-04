use crate::context::AppContext;
use crate::error::Result;
use crate::fl;

pub(crate) fn install(ctx: &AppContext) -> Result<()> {
    crate::daemon::manager::create().install(ctx)?;
    Ok(())
}

pub(crate) fn uninstall(_ctx: &AppContext) -> Result<()> {
    crate::daemon::manager::create().uninstall()?;
    Ok(())
}

pub(crate) fn status(_ctx: &AppContext) {
    let running = crate::daemon::is_daemon_running();
    let installed = crate::daemon::manager::create().is_installed();

    if running {
        tracing::info!("{}", fl!("daemon-running"));
        if let Some(health) = crate::daemon::health_check() {
            if let Some(ver) = health.get("version").and_then(|v| v.as_str()) {
                tracing::info!("  version: {ver}");
            }
            if let Some(uptime) = health.get("uptime_secs").and_then(serde_json::Value::as_u64) {
                tracing::info!("  uptime: {uptime}s");
            }
            if let Some(spotify) =
                health.get("spotify_detected").and_then(serde_json::Value::as_bool)
            {
                tracing::info!("  spotify detected: {spotify}");
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
