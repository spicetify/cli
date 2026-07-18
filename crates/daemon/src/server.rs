#[cfg(unix)]
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::time::Duration;

use spicetify::context::{AppContext, SharedContext};
use spicetify::daemon::bind_addr;

use crate::{routes, watcher};

#[cfg(windows)]
const INSTANCE_MUTEX_NAME: &str = "Spicetify-Daemon-Instance-Mutex";

#[cfg(unix)]
const INSTANCE_MUTEX_PATH: &str = "spicetify-daemon.lock";

const SHUTDOWN_GRACE: Duration = Duration::from_secs(1);

#[derive(Debug)]
pub struct DaemonState {
    pub ctx: Arc<SharedContext>,
    pub client: reqwest::Client,
    pub shutdown: Arc<tokio::sync::Notify>,
    pub startup: std::time::Instant,
    pub apps_watcher_active: Arc<AtomicBool>,
    pub config_watcher_active: Arc<AtomicBool>,
}

pub fn run() -> anyhow::Result<()> {
    let config_root = spicetify::platform::default_spicetify_config_root();
    let config_file = config_root.join("config.toml");
    let cfg = spicetify::context::Config::load(&config_file)?;
    let ctx = AppContext::from_config(config_root, &cfg)?;

    start(ctx)
}

fn start(ctx: AppContext) -> anyhow::Result<()> {
    let _lock = acquire_instance_lock(&ctx.config_root).map_err(|e| {
        tracing::error!(error = %e, "another daemon is already running");
        anyhow::anyhow!(e)
    })?;

    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .max_blocking_threads(1)
        .build()?;
    runtime.block_on(async move {
        let shared = Arc::new(SharedContext::new(ctx));
        let shutdown = Arc::new(tokio::sync::Notify::new());
        let apps_watcher_active = Arc::new(AtomicBool::new(false));
        let config_watcher_active = Arc::new(AtomicBool::new(false));
        let state = Arc::new(DaemonState {
            ctx: Arc::clone(&shared),
            client: build_http_client()?,
            shutdown: Arc::clone(&shutdown),
            startup: std::time::Instant::now(),
            apps_watcher_active: Arc::clone(&apps_watcher_active),
            config_watcher_active: Arc::clone(&config_watcher_active),
        });

        let apps = watcher::spawn_apps_watcher(
            Arc::clone(&shared),
            Arc::clone(&shutdown),
            Arc::clone(&apps_watcher_active),
        );
        let cfg = watcher::spawn_config_watcher(
            Arc::clone(&shared),
            Arc::clone(&shutdown),
            Arc::clone(&config_watcher_active),
        );

        run_server(state, shutdown, apps, cfg).await
    })
}

fn build_http_client() -> anyhow::Result<reqwest::Client> {
    Ok(reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none())
        .cookie_store(true)
        .build()?)
}

async fn run_server(
    state: Arc<DaemonState>,
    shutdown: Arc<tokio::sync::Notify>,
    apps: Option<tokio::task::JoinHandle<()>>,
    cfg: Option<tokio::task::JoinHandle<()>>,
) -> anyhow::Result<()> {
    let app = routes::build(state);
    let listener = tokio::net::TcpListener::bind(bind_addr()).await?;
    tracing::info!("{}", spicetify::fl!("daemon-listening", addr = bind_addr().to_string()));

    let ctrl_c_notify = Arc::clone(&shutdown);
    let ctrl_c_hdl = tokio::spawn(async move {
        if let Err(e) = tokio::signal::ctrl_c().await {
            tracing::error!(error = %e, "failed to install Ctrl-C handler");
            return;
        }
        tracing::info!("received Ctrl-C, shutting down");
        ctrl_c_notify.notify_waiters();
    });

    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            shutdown.notified().await;
        })
        .await?;

    ctrl_c_hdl.abort();

    let timed_out = tokio::time::timeout(SHUTDOWN_GRACE, async {
        if let Some(h) = apps
            && h.await.is_err()
        {
            tracing::warn!("apps watcher task failed to complete");
        }
        if let Some(h) = cfg
            && h.await.is_err()
        {
            tracing::warn!("config watcher task failed to complete");
        }
    })
    .await
    .is_err();

    if timed_out {
        tracing::warn!("shutdown grace period elapsed, forcing exit");
    }

    Ok(())
}

#[cfg(windows)]
fn acquire_instance_lock(_config_root: &std::path::Path) -> Result<LockGuard, String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    use windows::Win32::Foundation::{CloseHandle, ERROR_ALREADY_EXISTS, GetLastError};
    use windows::Win32::System::Threading::CreateMutexW;

    let name: Vec<u16> =
        OsStr::new(INSTANCE_MUTEX_NAME).encode_wide().chain(std::iter::once(0)).collect();

    #[allow(unsafe_code)]
    let handle = unsafe { CreateMutexW(None, false, windows::core::PCWSTR(name.as_ptr())) };
    #[allow(unsafe_code)]
    let err = unsafe { GetLastError() };

    if handle.is_err() || err == ERROR_ALREADY_EXISTS {
        if let Ok(h) = handle {
            #[allow(unsafe_code)]
            unsafe {
                if CloseHandle(h).is_err() {
                    tracing::warn!("failed to close duplicate mutex handle");
                }
            }
        }
        return Err("instance already exists".to_string());
    }
    let handle = handle.expect("CreateMutexW returns Ok for fixed-name mutex");
    Ok(LockGuard { inner: LockInner::Windows(WindowsMutex(handle)) })
}

#[cfg(unix)]
fn acquire_instance_lock(config_root: &std::path::Path) -> Result<LockGuard, String> {
    let lock_path = config_root.join(INSTANCE_MUTEX_PATH);
    let file = std::fs::OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&lock_path)
        .map_err(|e| format!("failed to open lock file: {e}"))?;
    fs4::FileExt::try_lock(&file).map_err(|_| "another daemon is already running".to_string())?;
    Ok(LockGuard { inner: LockInner::Unix { _file: file, path: lock_path } })
}

#[derive(Debug)]
enum LockInner {
    #[cfg(windows)]
    #[allow(dead_code)]
    Windows(WindowsMutex),
    #[cfg(unix)]
    Unix { _file: std::fs::File, path: PathBuf },
}

#[derive(Debug)]
pub struct LockGuard {
    inner: LockInner,
}

impl Drop for LockGuard {
    fn drop(&mut self) {
        match &self.inner {
            #[cfg(windows)]
            LockInner::Windows(_) => {}
            #[cfg(unix)]
            LockInner::Unix { path, .. } => {
                if let Err(e) = std::fs::remove_file(path)
                    && e.kind() != std::io::ErrorKind::NotFound
                {
                    tracing::warn!(error = %e, path = %path.display(), "failed to remove daemon lock file");
                }
            }
        }
    }
}

#[cfg(windows)]
#[derive(Debug)]
struct WindowsMutex(windows::Win32::Foundation::HANDLE);

#[cfg(windows)]
impl Drop for WindowsMutex {
    #[allow(unsafe_code)]
    fn drop(&mut self) {
        unsafe {
            if windows::Win32::Foundation::CloseHandle(self.0).is_err() {
                tracing::warn!("failed to close daemon mutex handle");
            }
        }
    }
}
