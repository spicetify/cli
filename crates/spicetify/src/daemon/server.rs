use std::{
    collections::HashMap, sync::{
        Arc, Mutex, atomic::{AtomicBool, Ordering}
    }, time::Duration
};

use anyhow::Result;
use axum::{
    Json, Router, extract::{
        Path, Request, State, ws::{Message, WebSocket, WebSocketUpgrade}
    }, http::{HeaderMap, HeaderValue, Method, StatusCode}, response::{IntoResponse, Response}, routing::{any, get, post}
};
use futures_util::StreamExt;
use notify::{EventKind, RecursiveMode, Watcher};
use percent_encoding::{AsciiSet, NON_ALPHANUMERIC, percent_encode};
use reqwest::Client;

use crate::{
    commands::{apply, protocol}, config::AppContext, i18n, logging, release::ReleaseInfo
};

/// Encodes everything except unreserved characters per RFC 3986 §2.3.
/// Equivalent to Go's `url.PathEscape` — used for embedding a redirect target URL
/// inside the proxy path segment.
const PATH_ESCAPE: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'.')
    .remove(b'_')
    .remove(b'~');

const BIND_ADDR: &str = "localhost:7967";
const ALLOWED_ORIGIN: &str = "https://xpui.app.spotify.com";

/// Inno Setup checks this mutex via `AppMutex` to prevent the installer from
/// proceeding while the daemon is active. Must match the `AppMutex` value
/// passed to Inno Setup from `build.ps1`.
#[cfg(windows)]
const INSTANCE_MUTEX_NAME: &str = "Spicetify-Daemon-Instance-Mutex";

fn acquire_instance_mutex() -> InstanceMutexGuard {
    #[cfg(windows)]
    {
        use std::{ffi::OsStr, os::windows::ffi::OsStrExt};

        unsafe extern "system" {
            fn CreateMutexW(
                lpMutexAttributes: *mut std::ffi::c_void,
                bInitialOwner: i32,
                lpName: *const u16,
            ) -> isize;
        }

        let name: Vec<u16> = OsStr::new(INSTANCE_MUTEX_NAME)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let handle = unsafe { CreateMutexW(std::ptr::null_mut(), 0, name.as_ptr()) };
        if handle != 0 {
            logging::info(i18n::lookup("mutex_acquired"));
            return InstanceMutexGuard { _handle: handle };
        }
        logging::warn(i18n::lookup("mutex_failed"));
    }

    InstanceMutexGuard { _handle: 0 }
}

struct InstanceMutexGuard {
    #[allow(dead_code)]
    _handle: isize,
}

// Held for process lifetime — safe to share across threads.
unsafe impl Send for InstanceMutexGuard {}
unsafe impl Sync for InstanceMutexGuard {}

pub fn start(ctx: &AppContext) -> Result<()> {
    let _mutex_guard = acquire_instance_mutex();

    let shared = Arc::new(Mutex::new(ctx.clone()));
    let watcher_tx = spawn_apps_watcher(shared.clone());
    let config_ctx = {
        shared
            .lock()
            .map(|g| g.clone())
            .unwrap_or_else(|e| e.into_inner().clone())
    };
    let watcher_shared = shared.clone();
    std::thread::spawn(move || watch_config(&config_ctx, watcher_shared, watcher_tx));

    let runtime = tokio::runtime::Runtime::new()?;
    runtime.block_on(run_server(shared))?;
    Ok(())
}

async fn run_server(ctx: Arc<Mutex<AppContext>>) -> Result<()> {
    let shutdown = Arc::new(tokio::sync::Notify::new());
    let state = Arc::new(DaemonState {
        ctx,
        client: Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .cookie_store(true)
            .build()?,
        shutdown: shutdown.clone(),
    });

    let app = Router::new()
        .route("/rpc", get(ws_handler))
        .route("/shutdown", post(shutdown_handler))
        .route("/self-update", post(self_update_handler))
        .route("/proxy/{*url}", any(proxy_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(BIND_ADDR).await?;
    logging::info(i18n::lookup_with_args(
        "daemon_listening",
        &[("addr", BIND_ADDR)],
    ));
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            shutdown.notified().await;
        })
        .await?;
    Ok(())
}

struct DaemonState {
    ctx: Arc<Mutex<AppContext>>,
    client: Client,
    shutdown: Arc<tokio::sync::Notify>,
}

fn spawn_apps_watcher(ctx: Arc<Mutex<AppContext>>) -> std::sync::mpsc::Sender<()> {
    let (tx, rx) = std::sync::mpsc::channel();
    let shutdown = Arc::new(AtomicBool::new(false));
    let sd = shutdown.clone();

    // Wake-from-recv thread: sets the atomic flag when shutdown is signaled,
    // avoiding the need to poll rx.try_recv() inside the event loop.
    std::thread::spawn(move || {
        rx.recv().ok();
        sd.store(true, Ordering::Release);
    });

    std::thread::spawn(move || {
        let apps = {
            match ctx.lock() {
                Ok(g) => g.spotify_apps_path(),
                Err(_) => return,
            }
        };
        let (event_tx, event_rx) = std::sync::mpsc::channel();
        let mut watcher = match notify::recommended_watcher(event_tx) {
            Ok(w) => w,
            Err(_) => return,
        };
        if watcher.watch(&apps, RecursiveMode::NonRecursive).is_err() {
            logging::fatal(i18n::lookup_with_args(
                "watch_failed",
                &[("path", &apps.display().to_string())],
            ));
            return;
        }
        logging::info(i18n::lookup_with_args(
            "watching",
            &[("path", &apps.display().to_string())],
        ));

        loop {
            if shutdown.load(Ordering::Acquire) {
                return;
            }
            match event_rx.recv_timeout(Duration::from_millis(100)) {
                Ok(Ok(event)) => {
                    if matches!(event.kind, EventKind::Create(_)) {
                        for p in &event.paths {
                            if p.file_name().and_then(|s| s.to_str()) == Some("xpui.spa")
                                && let Ok(app_ctx) = ctx.lock()
                                && let Err(e) = apply::run(&app_ctx)
                            {
                                logging::warn(e.to_string());
                            }
                        }
                    }
                }
                Ok(Err(e)) => logging::warn(e.to_string()),
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });
    tx
}

fn watch_config(
    ctx: &AppContext,
    shared: Arc<Mutex<AppContext>>,
    mut watcher_tx: std::sync::mpsc::Sender<()>,
) {
    let (tx, rx) = std::sync::mpsc::channel();
    let mut watcher = match notify::recommended_watcher(tx) {
        Ok(w) => w,
        Err(_) => return,
    };
    if watcher
        .watch(&ctx.config_file, RecursiveMode::NonRecursive)
        .is_err()
    {
        return;
    }

    loop {
        match rx.recv() {
            Ok(Ok(event)) if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) => {
                let new_ctx = match rebuild_context(ctx) {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                let old_data_path = {
                    match shared.lock() {
                        Ok(mut g) => {
                            let old = g.spotify_data_path.clone();
                            *g = new_ctx.clone();
                            old
                        }
                        Err(_) => continue,
                    }
                };

                if !new_ctx.daemon {
                    std::process::exit(0);
                }
                if new_ctx.spotify_data_path != old_data_path {
                    // TODO: wait for watcher to stop before restarting
                    // Go's daemon.go:106 has the same TODO. Currently sends a signal and
                    // immediately spawns a new watcher without confirming the old thread has
                    // exited. This can cause two watchers to run simultaneously and trigger
                    // duplicate apply runs. Should use a shutdown completion channel or
                    // thread::JoinHandle to confirm the old watcher has stopped first.
                    let _ = watcher_tx.send(());
                    watcher_tx = spawn_apps_watcher(shared.clone());
                }
            }
            Ok(Ok(_)) => continue,
            Ok(Err(e)) => logging::warn(e.to_string()),
            Err(_) => break,
        }
    }
}

fn rebuild_context(base: &AppContext) -> Result<AppContext> {
    let cfg = crate::config::Config::load(&base.config_file)?;
    Ok(AppContext::from_config(base.config_root.clone(), cfg))
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<DaemonState>>,
) -> impl IntoResponse {
    // TODO: add WebSocket origin check to only allow connections from ALLOWED_ORIGIN
    // Go has `upgrader.CheckOrigin = func(r *http.Request) bool { return true }` with a TODO to
    // improve. Use `ws.on_upgrade_with_sec_websocket_protocol` or check request headers for
    // Origin. Without this, any website can connect to the RPC WS and execute spicetify
    // operations.
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(mut socket: WebSocket, state: Arc<DaemonState>) {
    while let Some(Ok(msg)) = socket.next().await {
        if let Message::Text(text) = msg {
            logging::info(i18n::lookup_with_args("rpc_received", &[("msg", &text)]));
            let app_ctx = match state.ctx.lock() {
                Ok(g) => g.clone(),
                Err(_) => continue,
            };
            match protocol::handle(&app_ctx, &text) {
                Ok(res) if !res.is_empty() => {
                    let _ = socket.send(Message::Text(res.into())).await;
                }
                Err(e) => logging::warn(i18n::lookup_with_args(
                    "protocol_error",
                    &[("err", &e.to_string())],
                )),
                _ => {}
            }
        }
    }
}

async fn shutdown_handler(State(state): State<Arc<DaemonState>>) -> impl IntoResponse {
    logging::info(i18n::lookup("shutdown_requested"));
    state.shutdown.notify_waiters();
    (StatusCode::ACCEPTED, i18n::lookup("daemon_stopping_resp"))
}

async fn self_update_handler() -> impl IntoResponse {
    const RELEASES_URL: &str = "https://api.github.com/repos/veryboringhwl/app/releases/latest";

    let current_version = crate::version::current_version();

    let client = match Client::builder()
        .user_agent("spicetify-self-update")
        .build()
    {
        Ok(c) => c,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    let json: serde_json::Value = match client
        .get(RELEASES_URL)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
    {
        Ok(resp) => match resp.error_for_status() {
            Ok(resp) => match resp.json().await {
                Ok(val) => val,
                Err(e) => return (StatusCode::BAD_GATEWAY, e.to_string()).into_response(),
            },
            Err(e) => return (StatusCode::BAD_GATEWAY, e.to_string()).into_response(),
        },
        Err(e) => return (StatusCode::BAD_GATEWAY, e.to_string()).into_response(),
    };

    let release = match ReleaseInfo::from_json(&json) {
        Ok(r) => r,
        Err(e) => return (StatusCode::BAD_GATEWAY, e.to_string()).into_response(),
    };

    if !release.is_update_available(current_version) {
        return (
            StatusCode::OK,
            Json(serde_json::json!({"status": "up_to_date", "version": current_version})),
        )
            .into_response();
    }

    let asset = match release.find_installer() {
        Some(a) => a,
        None => {
            let name = format!("installer-{}-windows-amd64.exe", release.version);
            return (
                StatusCode::NOT_FOUND,
                i18n::lookup_with_args("no_release_asset", &[("name", &name)]),
            )
                .into_response();
        }
    };

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "status": "ready",
            "version": release.version,
            "current_version": current_version,
            "download_url": asset.download_url,
            "asset_name": asset.name,
        })),
    )
        .into_response()
}

async fn proxy_handler(
    State(state): State<Arc<DaemonState>>,
    Path(url): Path<String>,
    method: Method,
    headers: HeaderMap,
    request: Request,
) -> Response {
    if method == Method::OPTIONS {
        return cors_preflight();
    }

    let target = match url::Url::parse(&url) {
        Ok(u) => u,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, i18n::lookup("proxy_invalid_url")).into_response();
        }
    };

    let body = match axum::body::to_bytes(request.into_body(), usize::MAX).await {
        Ok(b) => b,
        Err(_) => {
            return (StatusCode::BAD_REQUEST, i18n::lookup("proxy_invalid_body")).into_response();
        }
    };

    let mut upstream = state
        .client
        .request(method.clone(), target.clone())
        .body(body);

    for (name, value) in &headers {
        if name != "host" && name != "x-set-headers" {
            upstream = upstream.header(name, value);
        }
    }

    if let Some(raw) = headers.get("x-set-headers")
        && let Ok(raw) = raw.to_str()
        && let Ok(extra) = serde_json::from_str::<HashMap<String, String>>(raw)
    {
        for (k, v) in extra {
            upstream = if v == "undefined" {
                upstream.header(&k, "")
            } else {
                upstream.header(&k, v)
            };
        }
    }

    let upstream = match upstream.send().await {
        Ok(r) => r,
        Err(_) => {
            return (
                StatusCode::BAD_GATEWAY,
                i18n::lookup("proxy_request_failed"),
            )
                .into_response();
        }
    };

    let status = upstream.status();
    let upstream_headers = upstream.headers().clone();

    let bytes = match upstream.bytes().await {
        Ok(b) => b,
        Err(_) => {
            return (StatusCode::BAD_GATEWAY, i18n::lookup("proxy_body_failed")).into_response();
        }
    };

    let mut response = (status, bytes).into_response();
    {
        let h = response.headers_mut();
        apply_cors(h);
        for (k, v) in &upstream_headers {
            h.insert(k, v.clone());
        }
        if let Some(loc) = h.get("location").and_then(|v| v.to_str().ok()) {
            let escaped = percent_encode(loc.as_bytes(), PATH_ESCAPE);
            let redirect = format!("http://{BIND_ADDR}/proxy/{escaped}");
            if let Ok(v) = HeaderValue::from_str(&redirect) {
                h.insert("location", v);
            }
        }
    }

    response
}

fn cors_preflight() -> Response {
    let mut headers = HeaderMap::new();
    apply_cors(&mut headers);
    headers.insert(
        "access-control-allow-methods",
        HeaderValue::from_static("GET, POST, PUT, DELETE, OPTIONS"),
    );
    headers.insert(
        "access-control-allow-headers",
        HeaderValue::from_static("content-type, x-set-headers"),
    );
    headers.insert("access-control-max-age", HeaderValue::from_static("86400"));
    (StatusCode::NO_CONTENT, headers, Json(serde_json::json!({}))).into_response()
}

fn apply_cors(h: &mut HeaderMap) {
    h.insert(
        "access-control-allow-origin",
        HeaderValue::from_static(ALLOWED_ORIGIN),
    );
    h.insert(
        "access-control-allow-credentials",
        HeaderValue::from_static("true"),
    );
}
