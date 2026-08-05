use std::time::Duration;

use crate::context::AppContext;
use crate::error::Result;
use crate::fl;

const START_TIMEOUT: Duration = Duration::from_secs(30);
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(15);

pub fn start(ctx: &AppContext) -> Result<()> {
    if is_running(ctx) {
        tracing::info!("{}", fl!("spotify-restarted"));
        return Ok(());
    }
    crate::process::spawn_detached(ctx)?;
    wait_for(ctx, true, START_TIMEOUT)?;
    tracing::info!("{}", fl!("spotify-started"));
    Ok(())
}

pub fn stop(ctx: &AppContext) -> Result<()> {
    tracing::info!("{}", fl!("spotify-stopping"));
    crate::process::force_kill_spotify(ctx);
    if let Err(e) = wait_for(ctx, false, SHUTDOWN_TIMEOUT) {
        tracing::warn!("{e}");
    }
    Ok(())
}

pub fn restart(ctx: &AppContext) -> Result<()> {
    stop(ctx)?;
    start(ctx)
}

#[must_use]
pub fn is_running(ctx: &AppContext) -> bool {
    let Some(image) = ctx.spotify_exec.file_name().and_then(|s| s.to_str()) else {
        return false;
    };
    crate::process::process_running(image)
}

fn wait_for(ctx: &AppContext, expect_running: bool, timeout: Duration) -> Result<()> {
    let start = std::time::Instant::now();
    let mut delay = Duration::from_millis(100);
    while start.elapsed() < timeout {
        if is_running(ctx) == expect_running {
            return Ok(());
        }
        std::thread::sleep(delay);
        delay = (delay * 2).min(Duration::from_millis(800));
    }
    Err(anyhow::anyhow!(if expect_running {
        fl!("spotify-start-timeout", secs = timeout.as_secs().to_string())
    } else {
        fl!("spotify-exit-timeout")
    }))
}
