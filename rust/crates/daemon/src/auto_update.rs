//! Daily automatic updates of the Spicetify binaries.
//!
//! The daemon only checks. When a newer release exists it launches
//! `spicetify self-update` as a detached process, which stops this daemon,
//! replaces both binaries and starts the new daemon. Spotify keeps running:
//! the new client code reaches it on the next apply.

use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use spicetify::context::{AppContext, SharedContext};

use crate::update_job::UpdateJobHandle;

const FIRST_CHECK_DELAY: Duration = Duration::from_mins(10);
const CHECK_INTERVAL: Duration = Duration::from_hours(24);
const RETRY_INTERVAL: Duration = Duration::from_hours(1);
const STAMP: &str = "self-update-checked";
const LOG: &str = "self-update.log";

/// Whether this daemon updates itself: the setting is on, and it runs from
/// the official installer's folder rather than a package manager's.
#[must_use]
pub fn active(ctx: &AppContext) -> bool {
    ctx.auto_update
        && spicetify::update::official_install_dir()
            .is_some_and(|dir| spicetify::update::is_official_install(&dir))
}

pub fn spawn(
    shared: Arc<SharedContext>,
    shutdown: Arc<tokio::sync::Notify>,
    update_job: UpdateJobHandle,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let stamp = shared.load().config_root.join("cache").join(STAMP);
        let mut wait = next_check(last_checked(&stamp), SystemTime::now());
        loop {
            tokio::select! {
                () = tokio::time::sleep(wait) => {}
                () = shutdown.notified() => return,
            }
            wait = check(&shared.load_full(), &update_job, &stamp).await;
        }
    })
}

/// Checks once and returns how long to wait before the next check.
async fn check(ctx: &AppContext, update_job: &UpdateJobHandle, stamp: &Path) -> Duration {
    if !active(ctx) {
        return CHECK_INTERVAL;
    }
    if update_job.status().owns_recovery() {
        return RETRY_INTERVAL;
    }
    match spicetify::commands::guard::try_acquire(&ctx.config_root) {
        Ok(guard) => drop(guard),
        Err(_) => return RETRY_INTERVAL,
    }
    let arch = spicetify::update::release::platform_arch(ctx);
    let release = match spicetify::update::check_for_update(arch).await {
        Ok(release) => release,
        Err(e) => {
            tracing::warn!(error = %e, "automatic update check failed");
            return RETRY_INTERVAL;
        }
    };
    record(stamp);
    let Some(release) = release else {
        tracing::debug!("Spicetify is up to date");
        return CHECK_INTERVAL;
    };
    if release.find_platform_asset(arch).is_none() {
        tracing::info!(version = %release.version(), arch, "the newest release has no build for this platform");
        return CHECK_INTERVAL;
    }
    tracing::info!(version = %release.version(), "installing a new Spicetify release");
    if let Err(e) = launch_self_update(&ctx.config_root) {
        tracing::warn!(error = %e, "could not start the automatic update");
    }
    CHECK_INTERVAL
}

/// How long to wait before checking, given when the last check ran: never
/// sooner than `FIRST_CHECK_DELAY` after start, and never later than a day.
fn next_check(last: Option<SystemTime>, now: SystemTime) -> Duration {
    let Some(last) = last else { return FIRST_CHECK_DELAY };
    (last + CHECK_INTERVAL)
        .duration_since(now)
        .unwrap_or(Duration::ZERO)
        .clamp(FIRST_CHECK_DELAY, CHECK_INTERVAL)
}

fn last_checked(stamp: &Path) -> Option<SystemTime> {
    std::fs::metadata(stamp).and_then(|meta| meta.modified()).ok()
}

fn record(stamp: &Path) {
    if let Some(dir) = stamp.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if let Err(e) = std::fs::write(stamp, b"") {
        tracing::warn!(error = %e, path = %stamp.display(), "could not record the update check");
    }
}

/// Starts `spicetify self-update` from this daemon's folder so it outlives
/// the daemon it restarts: in its own process group, and under systemd in
/// its own transient unit, since stopping a unit kills its whole cgroup.
/// The log keeps the last run only.
fn launch_self_update(config_root: &Path) -> std::io::Result<()> {
    let exe = std::env::current_exe()?;
    let dir = exe.parent().ok_or_else(|| std::io::Error::other("daemon has no parent folder"))?;
    let cli = dir.join(spicetify::update::release::binary_name());
    let log_path = config_root.join(LOG);
    let log = std::fs::File::create(&log_path)?;
    #[cfg(target_os = "linux")]
    let mut command = if std::env::var_os("INVOCATION_ID").is_some() {
        let mut command = std::process::Command::new("systemd-run");
        let _ = command
            .args(["--user", "--collect", "--quiet"])
            .arg(format!("--property=StandardOutput=append:{}", log_path.display()))
            .arg(format!("--property=StandardError=append:{}", log_path.display()))
            .arg("--")
            .arg(&cli);
        command
    } else {
        std::process::Command::new(&cli)
    };
    #[cfg(not(target_os = "linux"))]
    let mut command = std::process::Command::new(&cli);
    let _ = command
        .arg("self-update")
        .stdin(std::process::Stdio::null())
        .stdout(log.try_clone()?)
        .stderr(log);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        let _ = command.process_group(0);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
        let _ = command.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
    }
    let mut child = command.spawn()?;
    let _reaper =
        std::thread::Builder::new().name("spicetify-self-update".to_string()).spawn(move || {
            let _ = child.wait();
        })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checks_ten_minutes_after_start_then_daily() {
        let now = SystemTime::UNIX_EPOCH + Duration::from_hours(1000);
        assert_eq!(next_check(None, now), FIRST_CHECK_DELAY, "never checked");
        assert_eq!(
            next_check(Some(now - Duration::from_hours(30)), now),
            FIRST_CHECK_DELAY,
            "overdue, but a restarted daemon still settles first"
        );
        assert_eq!(
            next_check(Some(now - Duration::from_hours(20)), now),
            Duration::from_hours(4),
            "a restart doesn't reset the daily schedule"
        );
        assert_eq!(
            next_check(Some(now + Duration::from_hours(48)), now),
            CHECK_INTERVAL,
            "a stamp from the future waits at most a day"
        );
    }

    #[test]
    fn a_check_stamp_survives_as_the_last_check_time() {
        let dir =
            std::env::temp_dir().join(format!("spicetify-auto-update-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let stamp = dir.join("cache").join(STAMP);
        assert!(last_checked(&stamp).is_none());
        record(&stamp);
        let recorded = last_checked(&stamp).expect("stamp written");
        let age = SystemTime::now().duration_since(recorded).unwrap_or(Duration::ZERO);
        assert!(age < Duration::from_mins(1), "recorded now: {age:?}");
        std::fs::remove_dir_all(&dir).expect("cleanup");
    }
}
