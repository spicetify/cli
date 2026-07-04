// Platform.getLifecycleAPI()
// idk what else to call it

use std::time::Duration;

use crate::context::AppContext;
use crate::error::Result;
use crate::fl;
use crate::process::SpotifyProc;

const START_TIMEOUT: Duration = Duration::from_secs(30);
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(15);

pub fn start(ctx: &AppContext) -> Result<()> {
    if is_running(ctx) {
        tracing::info!("{}", fl!("spotify-restarted"));
        return Ok(());
    }
    let proc = SpotifyProc::spawn(ctx)?;
    {
        let mut guard = ctx.lock_process();
        *guard = Some(proc);
    }
    wait_for(ctx, true, START_TIMEOUT)?;
    tracing::info!("{}", fl!("spotify-started"));
    Ok(())
}

pub fn stop(ctx: &AppContext) -> Result<()> {
    let proc = { ctx.lock_process().take() };
    if let Some(mut p) = proc {
        tracing::info!("{}", fl!("spotify-stopping"));
        p.terminate(SHUTDOWN_TIMEOUT);
    }
    SpotifyProc::force_kill_orphans(ctx);
    wait_for(ctx, false, SHUTDOWN_TIMEOUT)?;
    Ok(())
}

pub fn restart(ctx: &AppContext) -> Result<()> {
    stop(ctx)?;
    start(ctx)
}

pub fn is_running(ctx: &AppContext) -> bool {
    match ctx.lock_process().as_mut() {
        Some(proc) => proc.is_alive(),
        None => false,
    }
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
