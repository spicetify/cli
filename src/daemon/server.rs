use std::{
    collections::HashMap, sync::{Arc, Mutex}, time::Duration
};

use anyhow::Result;
use axum::{
    Json, Router, extract::{
        Path, Request, State, ws::{Message, WebSocket, WebSocketUpgrade}
    }, http::{HeaderMap, HeaderValue, Method, StatusCode}, response::{IntoResponse, Response}, routing::{any, get, post}
};
use futures_util::StreamExt;
use notify::{EventKind, RecursiveMode, Watcher};
use reqwest::Client;

use crate::{
    commands::{apply, protocol}, config::AppContext, logging
};

const BIND_ADDR: &str = "localhost:7967";
const ALLOWED_ORIGIN: &str = "https://xpui.app.spotify.com";

pub fn start(ctx: &AppContext) -> Result<()> {
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
        // TODO: add cookie_store to preserve cookies across proxy requests
        // reqwest needs the "cookies" feature: Client::builder().cookie_store(true)
        // Equivalent to Go's `cookiejar` with `publicsuffix` domain matching.
        // Without this, authenticated proxied API calls will break (session cookies lost).
        client: Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()?,
        shutdown: shutdown.clone(),
    });

    let app = Router::new()
        .route("/rpc", get(ws_handler))
        .route("/shutdown", post(shutdown_handler))
        .route("/proxy/{*url}", any(proxy_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(BIND_ADDR).await?;
    logging::info(&format!("Daemon listening on {BIND_ADDR}"));
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

// TODO: add graceful shutdown coordination between watchers.
// When `watch_config` restarts the apps watcher, it sends `()` on watcher_tx and immediately
// spawns a new watcher without confirming the old one has stopped. Go has the same issue with
// a TODO comment. Fix: send a shutdown signal and wait for the old thread to finish first.
fn spawn_apps_watcher(ctx: Arc<Mutex<AppContext>>) -> std::sync::mpsc::Sender<()> {
    let (tx, rx) = std::sync::mpsc::channel();
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
            logging::fatal(&format!("failed to watch: {}", apps.display()));
            return;
        }
        logging::info(&format!("watching: {}", apps.display()));

        loop {
            if rx.try_recv().is_ok() {
                return;
            }
            // TODO: replace polling loop with event-driven watcher (use tokio + notify's async
            // watcher) Go uses `fsnotify` with `context.Context` for proper
            // cancellation. This 200ms polling loop is less responsive and less clean.
            // Consider switching to `notify::EventStream` (requires `tokio` feature on
            // notify) for async event-driven watching.
            match event_rx.recv_timeout(Duration::from_millis(200)) {
                Ok(Ok(event)) => {
                    if matches!(event.kind, EventKind::Create(_)) {
                        for p in &event.paths {
                            if p.file_name().and_then(|s| s.to_str()) == Some("xpui.spa") {
                                if let Ok(app_ctx) = ctx.lock() {
                                    if let Err(e) = apply::run(&app_ctx) {
                                        logging::warn(&e.to_string());
                                    }
                                }
                            }
                        }
                    }
                }
                Ok(Err(e)) => logging::warn(&e.to_string()),
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
            Ok(Err(e)) => logging::warn(&e.to_string()),
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
            logging::info(&format!("rpc: {text}"));
            let app_ctx = match state.ctx.lock() {
                Ok(g) => g.clone(),
                Err(_) => continue,
            };
            match protocol::handle(&app_ctx, &text) {
                Ok(res) if !res.is_empty() => {
                    let _ = socket.send(Message::Text(res.into())).await;
                }
                Err(e) => logging::warn(&format!("protocol error: {e}")),
                _ => {}
            }
        }
    }
}

async fn shutdown_handler(State(state): State<Arc<DaemonState>>) -> impl IntoResponse {
    logging::info("shutdown requested");
    state.shutdown.notify_waiters();
    (StatusCode::ACCEPTED, "daemon stopping")
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
        Err(_) => return (StatusCode::BAD_REQUEST, "invalid proxy url").into_response(),
    };

    let body = match axum::body::to_bytes(request.into_body(), usize::MAX).await {
        Ok(b) => b,
        Err(_) => return (StatusCode::BAD_REQUEST, "invalid request body").into_response(),
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

    if let Some(raw) = headers.get("x-set-headers") {
        if let Ok(raw) = raw.to_str() {
            if let Ok(extra) = serde_json::from_str::<HashMap<String, String>>(raw) {
                for (k, v) in extra {
                    upstream = if v == "undefined" {
                        upstream.header(&k, "")
                    } else {
                        upstream.header(&k, v)
                    };
                }
            }
        }
    }

    let upstream = match upstream.send().await {
        Ok(r) => r,
        Err(_) => return (StatusCode::BAD_GATEWAY, "proxy request failed").into_response(),
    };

    let status = upstream.status();
    let upstream_headers = upstream.headers().clone();

    let bytes = match upstream.bytes().await {
        Ok(b) => b,
        Err(_) => return (StatusCode::BAD_GATEWAY, "proxy body failed").into_response(),
    };

    let mut response = (status, bytes).into_response();
    {
        let h = response.headers_mut();
        apply_cors(h);
        for (k, v) in &upstream_headers {
            h.insert(k, v.clone());
        }
        if let Some(loc) = h.get("location").and_then(|v| v.to_str().ok()) {
            // TODO: use path-encoding (not form-encoding) for redirect URL rewriting
            // Go uses `url.PathEscape`; this uses `byte_serialize` which form-encodes chars like
            // '/' and '?'. This can produce incorrect redirect URLs. Use
            // percent-encoding with PATH_SEGMENT_ENCODE_SET.
            let escaped = url::form_urlencoded::byte_serialize(loc.as_bytes()).collect::<String>();
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
