// FIXME: auto-apply after Spotify update does not trigger reliably.
// The watcher detects the xpui.spa change but the apply is often too
// slow and races with Spotify startup. Restarting Spotify resolves it.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use notify::{Event, EventKind, RecursiveMode, Watcher};
use spicetify::context::{AppContext, SharedContext};
use spicetify::{commands, fl};
use tokio::sync::{Notify, mpsc};

const DEBOUNCE: Duration = Duration::from_millis(500);

pub fn spawn_apps_watcher(
    shared: Arc<SharedContext>,
    shutdown: Arc<Notify>,
    active: Arc<AtomicBool>,
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
        run_loop(
            rx,
            is_xpui_change,
            move || {
                let arc = shared.load_full();
                if let Err(e) = commands::dispatch(&commands::Command::Apply, &arc) {
                    tracing::warn!(error = %e, "auto-apply failed");
                }
            },
            shutdown,
        )
        .await;
        active.store(false, Ordering::Release);
    }))
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
            move || match rebuild_context(&shared, &config_file) {
                Ok(c) => shared.store(c),
                Err(e) => tracing::warn!(error = %e, "failed to rebuild context"),
            },
            shutdown,
        )
        .await;
        active.store(false, Ordering::Release);
    }))
}

async fn run_loop<P, A>(
    mut rx: mpsc::UnboundedReceiver<notify::Result<Event>>,
    should_trigger: P,
    mut on_trigger: A,
    shutdown: Arc<Notify>,
) where
    P: Fn(&Event) -> bool,
    A: FnMut(),
{
    let mut deadline: Option<tokio::time::Instant> = None;

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
                on_trigger();
            }
            res = rx.recv() => {
                if res.is_none() {
                    break;
                }
                match res {
                    Some(Ok(event)) if should_trigger(&event) => {
                        deadline = Some(tokio::time::Instant::now() + DEBOUNCE);
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
