use std::time::Duration;

use crate::context::AppContext;
use crate::error::Result;
use crate::fl;

const START_TIMEOUT: Duration = Duration::from_secs(30);
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(15);
const KILL_TIMEOUT: Duration = Duration::from_secs(5);

/// Spotify processes that outlived SIGKILL. A process in that state can't
/// serve a client, so it doesn't count as running and a start launches past it.
static STUCK: std::sync::Mutex<Vec<(String, u32)>> = std::sync::Mutex::new(Vec::new());

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
    if let Some(image) = image(ctx) {
        stop_image(image, SHUTDOWN_TIMEOUT, KILL_TIMEOUT);
    }
    Ok(())
}

/// Waits for `image` to exit after a SIGTERM, escalating to SIGKILL, and
/// sets aside any process that survives both.
fn stop_image(image: &str, graceful: Duration, forced: Duration) {
    if wait_until(image, false, graceful) {
        return;
    }
    tracing::warn!("Spotify did not exit within {}s; killing it", graceful.as_secs());
    let targets = crate::process::pids(image);
    crate::process::kill_image_hard(image);
    if wait_until(image, false, forced) {
        return;
    }
    let Some(targets) = targets else {
        tracing::warn!("Spotify is still running after being killed");
        return;
    };
    // Only processes that were killed: one started meanwhile is a real client.
    let survivors: Vec<u32> = crate::process::pids(image)
        .unwrap_or_default()
        .into_iter()
        .filter(|pid| targets.contains(pid))
        .collect();
    tracing::warn!(
        "Spotify process(es) {survivors:?} would not exit even when killed; starting a new one past them"
    );
    STUCK
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .extend(survivors.into_iter().map(|pid| (image.to_string(), pid)));
}

pub fn restart(ctx: &AppContext) -> Result<()> {
    stop(ctx)?;
    start(ctx)
}

#[must_use]
pub fn is_running(ctx: &AppContext) -> bool {
    image(ctx).is_some_and(running)
}

fn image(ctx: &AppContext) -> Option<&str> {
    ctx.spotify_exec.file_name().and_then(|s| s.to_str())
}

fn running(image: &str) -> bool {
    let Some(pids) = crate::process::pids(image) else {
        return crate::process::process_running(image);
    };
    let mut stuck = STUCK.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    // A set-aside process that has since exited frees its PID for a real client.
    stuck.retain(|(name, pid)| name != image || pids.contains(pid));
    pids.iter().any(|pid| !stuck.iter().any(|(name, stuck)| name == image && stuck == pid))
}

fn wait_until(image: &str, expect_running: bool, timeout: Duration) -> bool {
    let start = std::time::Instant::now();
    let mut delay = Duration::from_millis(100);
    while start.elapsed() < timeout {
        if running(image) == expect_running {
            return true;
        }
        std::thread::sleep(delay);
        delay = (delay * 2).min(Duration::from_millis(800));
    }
    running(image) == expect_running
}

fn wait_for(ctx: &AppContext, expect_running: bool, timeout: Duration) -> Result<()> {
    if image(ctx).is_some_and(|image| wait_until(image, expect_running, timeout)) {
        return Ok(());
    }
    Err(anyhow::anyhow!(if expect_running {
        fl!("spotify-start-timeout", secs = timeout.as_secs().to_string())
    } else {
        fl!("spotify-exit-timeout")
    }))
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    /// A process named `name` that ignores SIGTERM, as a hung Spotify does.
    fn stubborn(name: &str) -> (std::path::PathBuf, std::process::Child) {
        let dir = std::env::temp_dir().join(format!("spicetify-lifecycle-{name}"));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp dir");
        let exe = dir.join(name);
        let _ = std::fs::copy(std::env::current_exe().expect("test binary"), &exe).expect("copy");
        // An ignored signal stays ignored across exec, so the copy ignores SIGTERM.
        let child = std::process::Command::new("sh")
            .arg("-c")
            .arg(format!(
                "trap '' TERM; exec '{}' --exact lifecycle::tests::sleeper --ignored",
                exe.display()
            ))
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .expect("spawn");
        assert!(wait_until(name, true, Duration::from_secs(5)), "{name} started");
        (dir, child)
    }

    #[test]
    #[ignore = "the stand-in process that stubborn() runs"]
    fn sleeper() {
        std::thread::sleep(Duration::from_secs(60));
    }

    #[test]
    fn a_stop_kills_a_client_that_ignores_sigterm() {
        let name = format!("stbn{}", std::process::id() % 100_000);
        let (dir, mut child) = stubborn(&name);
        let own = crate::process::pids(&name).expect("pgrep lists processes");
        crate::process::kill_image(&name);
        stop_image(&name, Duration::from_millis(500), Duration::from_secs(5));
        assert!(!running(&name), "SIGKILL follows an ignored SIGTERM");
        let _ = child.wait();
        let stuck = STUCK.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        assert!(stuck.iter().all(|(_, pid)| !own.contains(pid)), "nothing of ours was set aside");
        std::fs::remove_dir_all(&dir).expect("cleanup");
    }

    #[test]
    fn a_process_set_aside_no_longer_counts_as_running() {
        let name = format!("stbx{}", std::process::id() % 100_000);
        let (dir, mut child) = stubborn(&name);
        let pids = crate::process::pids(&name).expect("pgrep lists processes");
        assert!(running(&name));
        STUCK
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .extend(pids.iter().map(|pid| (name.clone(), *pid)));
        assert!(!running(&name), "a start launches past a process that would not die");
        STUCK
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .retain(|(stuck, _)| stuck != &name);
        child.kill().expect("kill");
        let _ = child.wait();
        std::fs::remove_dir_all(&dir).expect("cleanup");
    }
}
