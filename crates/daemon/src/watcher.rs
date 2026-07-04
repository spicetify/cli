// if spotify updates it doesnt apply whenit auto starts
// its a bit too slow and restart fixes
// TODO: FIX THIS

use std::sync::Arc;
use std::time::Duration;

use notify::{Event, EventKind, RecursiveMode, Watcher};
use spicetify::commands::apply;
use spicetify::context::{AppContext, SharedContext};
use spicetify::fl;
use tokio::sync::{Notify, mpsc};

const DEBOUNCE: Duration = Duration::from_millis(500);

pub fn spawn_apps_watcher(
    shared: SharedContext<AppContext>,
    shutdown: Arc<Notify>,
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

    Some(tokio::spawn(async move {
        let _watcher = watcher;
        run_loop(
            rx,
            is_xpui_change,
            move || {
                let arc = shared.load_full();
                if let Err(e) = apply::run(&arc) {
                    tracing::warn!(error = %e, "auto-apply failed");
                }
            },
            shutdown,
        )
        .await;
    }))
}

pub fn spawn_config_watcher(
    shared: SharedContext<AppContext>,
    shutdown: Arc<Notify>,
) -> Option<tokio::task::JoinHandle<()>> {
    let arch = shared.load_full();
    let config_file = arch.config_file.clone();
    drop(arch);

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
                if let Some(Ok(event)) = res
                    && should_trigger(&event)
                {
                    deadline = Some(tokio::time::Instant::now() + DEBOUNCE);
                }
            }
        }
    }
}

fn is_xpui_change(event: &Event) -> bool {
    event.paths.iter().any(|p| p.file_name().and_then(|s| s.to_str()) == Some("xpui.spa"))
        && matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_))
}

fn is_config_change(event: &Event) -> bool {
    event.paths.iter().any(|p| p.file_name().and_then(|s| s.to_str()) == Some("config.toml"))
        && matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_))
}

fn rebuild_context(
    shared: &SharedContext<AppContext>,
    config_file: &std::path::Path,
) -> spicetify::error::Result<AppContext> {
    let base = shared.load_full();
    let cfg = spicetify::context::Config::load(config_file)?;
    AppContext::from_config(base.config_root.clone(), &cfg)
}
