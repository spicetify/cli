// Auto-apply sequencing: a Spotify update writes a fresh xpui.spa. The watcher
// debounces the event burst, waits for the client to exit before applying,
// and swallows the file events apply itself
// generates, so one update means exactly one apply.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use notify::{Event, EventKind, RecursiveMode, Watcher};
use spicetify::context::{AppContext, SharedContext};
use spicetify::{commands, fl};
use tokio::sync::{Notify, mpsc};

use crate::update_job::UpdateJobHandle;

const DEBOUNCE: Duration = Duration::from_millis(500);

/// Trigger-matching events are ignored for this long after an apply, which
/// rewrites xpui.spa itself while restoring, extracting and re-renaming.
const SELF_EVENT_COOLDOWN: Duration = Duration::from_secs(5);

/// How long to wait for the client to exit on its own. The daemon runs
/// unattended, so it never force-quits a client the user may be listening to;
/// past this ceiling the re-apply is skipped and left to the next trigger.
const CLIENT_EXIT_CEILING: Duration = Duration::from_mins(30);

/// Settle time after the client is observed down, so an updater still touching
/// files gets out of the way.
const EXIT_SETTLE: Duration = Duration::from_secs(1);

pub fn spawn_apps_watcher(
    shared: Arc<SharedContext>,
    shutdown: Arc<Notify>,
    active: Arc<AtomicBool>,
    update_job: UpdateJobHandle,
) -> Option<tokio::task::JoinHandle<()>> {
    let apps = (*shared.load_full()).spotify_apps_path();

    let (tx, rx) = mpsc::unbounded_channel();
    let Ok(mut watcher) = notify::recommended_watcher(move |res| {
        if let Err(e) = tx.send(res) {
            tracing::warn!(error = %e, "apps watcher channel closed");
        }
    }) else {
        tracing::error!("{}", fl!("watch-failed", path = apps.to_string_lossy()));
        return None;
    };
    if watcher.watch(&apps, RecursiveMode::NonRecursive).is_err() {
        tracing::error!("{}", fl!("watch-failed", path = apps.to_string_lossy()));
        return None;
    }
    tracing::info!("{}", fl!("watching", path = apps.to_string_lossy()));

    active.store(true, Ordering::Release);
    Some(tokio::spawn(async move {
        let _watcher = watcher;
        let mut applies: u32 = 0;
        run_loop(
            rx,
            is_xpui_change,
            move || {
                applies += 1;
                let nth = applies;
                let update_job = update_job.clone();
                let ctx = shared.load_full();
                async move {
                    if update_job.status().owns_recovery() {
                        update_job.nudge_apps_changed();
                        return;
                    }
                    let joined = tokio::task::spawn_blocking(move || auto_apply(&ctx, nth)).await;
                    if joined.is_err() {
                        tracing::error!("auto-apply task panicked");
                    }
                }
            },
            shutdown,
        )
        .await;
        active.store(false, Ordering::Release);
    }))
}

/// One auto-apply attempt, ordered after the updater's own restart cycle.
fn auto_apply(ctx: &AppContext, nth: u32) {
    // A stock archive means an update already landed. Repair is needed even
    // when update protection is blocked or cannot be determined.
    if !ctx.spotify_apps_path().join("xpui.spa").is_file() {
        tracing::info!("stock xpui.spa is not present; skipping auto-apply");
        return;
    }

    if spicetify::lifecycle::is_running(ctx) {
        // Make the polite wait visible: from the outside it looks like the
        // daemon missed the update, when it is deliberately refusing to
        // close a client the user may be listening to.
        tracing::info!(
            "a Spotify update landed; waiting up to {} minutes for the client to exit before re-applying",
            CLIENT_EXIT_CEILING.as_secs() / 60
        );
    }
    tracing::info!(
        nth,
        "auto-apply triggered by a Spotify update; waiting for pending package operations"
    );
    let guard = match wait_for_idle_guard(&ctx.config_root, CLIENT_EXIT_CEILING, || {
        spicetify::lifecycle::is_running(ctx)
    }) {
        Ok(guard) => guard,
        Err(e) => {
            tracing::warn!(error = %e, "auto-apply could not acquire an idle client; run `spicetify apply` when convenient");
            return;
        }
    };
    if !ctx.spotify_apps_path().join("xpui.spa").is_file() {
        tracing::info!("stock xpui.spa is no longer present; skipping auto-apply");
        return;
    }
    if let Err(e) = commands::apply::run(ctx, &guard, false) {
        tracing::warn!(error = %e, "auto-apply failed");
    }
}

fn wait_for_idle_guard(
    config_root: &std::path::Path,
    timeout: Duration,
    mut is_running: impl FnMut() -> bool,
) -> anyhow::Result<commands::guard::DisruptiveOperationGuard> {
    let deadline = std::time::Instant::now() + timeout;
    let mut waited = false;
    loop {
        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        if remaining.is_zero() {
            anyhow::bail!(
                "Spotify or a package operation is still busy after {} seconds",
                timeout.as_secs()
            );
        }
        if is_running() {
            waited = true;
            std::thread::sleep(remaining.min(Duration::from_secs(2)));
            continue;
        }
        if waited {
            std::thread::sleep(remaining.min(EXIT_SETTLE));
            waited = false;
            continue;
        }
        match commands::guard::acquire_with_timeout(
            config_root,
            remaining.min(Duration::from_secs(2)),
        ) {
            Ok(guard) if !is_running() => return Ok(guard),
            // Release the guard and resume the polite wait if Spotify relaunched.
            Ok(_) => waited = true,
            Err(error) if commands::guard::is_contention(&error) => {}
            Err(error) => return Err(error),
        }
    }
}

pub fn spawn_config_watcher(
    shared: Arc<SharedContext>,
    shutdown: Arc<Notify>,
    active: Arc<AtomicBool>,
) -> Option<tokio::task::JoinHandle<()>> {
    let config_file = shared.load().config_file.clone();

    let (tx, rx) = mpsc::unbounded_channel();
    let Ok(mut watcher) = notify::recommended_watcher(move |res| {
        if let Err(e) = tx.send(res) {
            tracing::warn!(error = %e, "config watcher channel closed");
        }
    }) else {
        tracing::warn!("failed to create config watcher");
        return None;
    };
    if watcher.watch(&config_file, RecursiveMode::NonRecursive).is_err() {
        tracing::warn!("failed to watch config file");
        return None;
    }

    active.store(true, Ordering::Release);
    Some(tokio::spawn(async move {
        let _watcher = watcher;
        run_loop(
            rx,
            is_config_change,
            move || {
                match rebuild_context(&shared, &config_file) {
                    Ok(c) => shared.store(c),
                    Err(e) => tracing::warn!(error = %e, "failed to rebuild context"),
                }
                std::future::ready(())
            },
            shutdown,
        )
        .await;
        active.store(false, Ordering::Release);
    }))
}

async fn run_loop<P, A, Fut>(
    mut rx: mpsc::UnboundedReceiver<notify::Result<Event>>,
    should_trigger: P,
    mut on_trigger: A,
    shutdown: Arc<Notify>,
) where
    P: Fn(&Event) -> bool,
    A: FnMut() -> Fut,
    Fut: Future<Output = ()>,
{
    let mut deadline: Option<tokio::time::Instant> = None;
    let mut ignore_until: Option<tokio::time::Instant> = None;

    loop {
        let current = deadline;
        let sleep = async move {
            match current {
                Some(d) => tokio::time::sleep_until(d).await,
                None => std::future::pending::<()>().await,
            }
        };
        tokio::pin!(sleep);

        tokio::select! {
            biased;
            () = shutdown.notified() => break,
            () = &mut sleep => {
                deadline = None;
                on_trigger().await;
                // The trigger rewrites the watched files; drain what queued
                // up during it and ignore stragglers for a cooldown so the
                // trigger cannot schedule itself again.
                while rx.try_recv().is_ok() {}
                ignore_until = Some(tokio::time::Instant::now() + SELF_EVENT_COOLDOWN);
            }
            res = rx.recv() => {
                if res.is_none() {
                    break;
                }
                match res {
                    Some(Ok(event)) if should_trigger(&event) => {
                        let suppressed = ignore_until
                            .is_some_and(|t| tokio::time::Instant::now() < t);
                        if !suppressed {
                            deadline = Some(tokio::time::Instant::now() + DEBOUNCE);
                        }
                    }
                    Some(Err(e)) => {
                        tracing::warn!(error = %e, "file watcher error");
                    }
                    _ => {}
                }
            }
        }
    }
}

fn is_file_change(event: &Event, filename: &str) -> bool {
    event.paths.iter().any(|p| p.file_name().and_then(|s| s.to_str()) == Some(filename))
        && matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_))
}

fn is_xpui_change(event: &Event) -> bool {
    is_file_change(event, "xpui.spa")
}

fn is_config_change(event: &Event) -> bool {
    is_file_change(event, "config.toml")
}

fn rebuild_context(
    shared: &SharedContext,
    config_file: &std::path::Path,
) -> spicetify::error::Result<AppContext> {
    let base = shared.load_full();
    let cfg = spicetify::context::Config::load(config_file)?;
    AppContext::from_config(base.config_root.clone(), &cfg)
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::AtomicU32;

    use super::*;

    fn scratch(name: &str) -> anyhow::Result<std::path::PathBuf> {
        let nonce = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_nanos();
        let root = std::env::temp_dir()
            .join(format!("spicetify-idle-{name}-{}-{nonce}", std::process::id()));
        std::fs::create_dir(&root)?;
        Ok(root)
    }

    #[test]
    fn auto_apply_retries_after_a_lock_wait_slice_expires() -> anyhow::Result<()> {
        let root = scratch("contention")?;
        let mut competing = Some(commands::guard::try_acquire(&root)?);
        let mut checks = 0;
        let result = wait_for_idle_guard(&root, Duration::from_secs(10), || {
            checks += 1;
            if checks == 2 {
                drop(competing.take());
            }
            false
        });
        drop(competing);
        drop(result?);
        assert!(checks >= 3, "retry must recheck the client before and after acquiring");
        std::fs::remove_dir_all(root)?;
        Ok(())
    }

    #[test]
    fn auto_apply_resumes_waiting_when_spotify_relaunches() -> anyhow::Result<()> {
        let root = scratch("relaunch")?;
        let mut checks = 0;
        let result = wait_for_idle_guard(&root, Duration::from_secs(10), || {
            checks += 1;
            match checks {
                // Idle before locking, but restarted by the post-lock check.
                2 => true,
                3 => {
                    // The polite wait must not keep package operations locked.
                    drop(commands::guard::try_acquire(&root).expect("guard released"));
                    false
                }
                _ => false,
            }
        });
        drop(result?);
        assert!(checks >= 5, "a restart must resume waiting, not abandon the repair");
        std::fs::remove_dir_all(root)?;
        Ok(())
    }

    #[test]
    fn auto_apply_wait_has_one_deadline_and_preserves_filesystem_errors() -> anyhow::Result<()> {
        let root = scratch("deadline")?;
        let guard = commands::guard::try_acquire(&root)?;
        let error = wait_for_idle_guard(&root, Duration::from_millis(20), || false)
            .expect_err("the operation guard is still held");
        assert!(error.to_string().contains("still busy"));
        drop(guard);
        let file = root.join("not-a-directory");
        std::fs::write(&file, "sentinel")?;
        let error = wait_for_idle_guard(&file, Duration::from_secs(60), || false)
            .expect_err("the config root is a file");
        assert!(error.downcast_ref::<std::io::Error>().is_some());
        std::fs::remove_dir_all(root)?;
        Ok(())
    }

    #[expect(clippy::unnecessary_wraps, reason = "matches the channel's item type")]
    fn event() -> notify::Result<Event> {
        Ok(Event { kind: EventKind::Modify(notify::event::ModifyKind::Any), ..Event::default() })
    }

    /// A trigger whose own work emits watcher events (as apply does) must run
    /// once per external change, not loop on its self-inflicted events.
    #[tokio::test(start_paused = true)]
    async fn self_inflicted_events_do_not_retrigger() {
        let (tx, rx) = mpsc::unbounded_channel();
        let shutdown = Arc::new(Notify::new());
        let count = Arc::new(AtomicU32::new(0));

        let c = Arc::clone(&count);
        let self_tx = tx.clone();
        let handle = tokio::spawn(run_loop(
            rx,
            |_: &Event| true,
            move || {
                let _ = c.fetch_add(1, Ordering::SeqCst);
                // simulate apply rewriting the watched file
                let _ = self_tx.send(event());
                let _ = self_tx.send(event());
                std::future::ready(())
            },
            Arc::clone(&shutdown),
        ));

        tx.send(event()).expect("loop is receiving");
        tokio::time::sleep(DEBOUNCE * 2).await;
        assert_eq!(count.load(Ordering::SeqCst), 1, "one external change, one trigger");

        // Still exactly one after the cooldown would have fired any stragglers.
        tokio::time::sleep(SELF_EVENT_COOLDOWN * 2).await;
        assert_eq!(count.load(Ordering::SeqCst), 1, "self-events must not retrigger");

        // A genuinely new change after the cooldown triggers again.
        tx.send(event()).expect("loop is receiving");
        tokio::time::sleep(DEBOUNCE * 2).await;
        assert_eq!(count.load(Ordering::SeqCst), 2, "fresh change triggers");

        shutdown.notify_waiters();
        handle.await.expect("loop exits cleanly");
    }

    /// Events inside the debounce window collapse into a single trigger.
    #[tokio::test(start_paused = true)]
    async fn burst_collapses_to_one_trigger() {
        let (tx, rx) = mpsc::unbounded_channel();
        let shutdown = Arc::new(Notify::new());
        let count = Arc::new(AtomicU32::new(0));

        let c = Arc::clone(&count);
        let handle = tokio::spawn(run_loop(
            rx,
            |_: &Event| true,
            move || {
                let _ = c.fetch_add(1, Ordering::SeqCst);
                std::future::ready(())
            },
            Arc::clone(&shutdown),
        ));

        for _ in 0..5 {
            tx.send(event()).expect("loop is receiving");
        }
        tokio::time::sleep(DEBOUNCE * 2).await;
        assert_eq!(count.load(Ordering::SeqCst), 1);

        shutdown.notify_waiters();
        handle.await.expect("loop exits cleanly");
    }
}
