use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{any, get, post};
use spicetify::commands::protocol;
use tokio_stream::StreamExt;
use tower_http::cors::{AllowHeaders, AllowOrigin, CorsLayer, ExposeHeaders};

use crate::server::DaemonState;
use crate::{health, proxy};

pub const ALLOWED_ORIGIN: &str = "https://xpui.app.spotify.com";

/// Header carrying the token apply injected into the patched client. CORS
/// only constrains browsers, so it is what actually keeps other local
/// software off the proxy.
pub const TOKEN_HEADER: &str = "x-spicetify-token";

/// Whether a request presents the daemon token. Missing token file means the
/// client was never patched by this install, so nothing is authorised.
pub fn authorized(state: &DaemonState, headers: &HeaderMap) -> bool {
    let expected = spicetify::daemon::token::read(&state.ctx.load().config_root);
    let Some(expected) = expected else { return false };
    headers
        .get(TOKEN_HEADER)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|presented| spicetify::daemon::token::matches(&expected, presented))
}

fn cors_layer() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(AllowOrigin::exact(HeaderValue::from_static(ALLOWED_ORIGIN)))
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::PATCH])
        .allow_headers(AllowHeaders::mirror_request())
        .expose_headers(ExposeHeaders::any())
        .allow_private_network(true)
        .max_age(Duration::from_hours(24))
}

pub fn build(state: Arc<DaemonState>) -> Router {
    Router::new()
        .route("/health", get(health::handler))
        .route("/rpc", get(ws_handler))
        .route("/shutdown", post(shutdown_handler))
        .route("/proxy", get(proxy::status))
        .route("/proxy/", get(proxy::status))
        .route("/proxy/{*url}", any(proxy::handler))
        .layer(cors_layer())
        .with_state(state)
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<DaemonState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let origin = headers.get("origin").and_then(|v| v.to_str().ok()).unwrap_or("");

    if !origin.is_empty() && origin != ALLOWED_ORIGIN {
        tracing::warn!(%origin, "WebSocket connection rejected: origin not allowed");
        return (StatusCode::FORBIDDEN, "origin not allowed").into_response();
    }

    if !authorized(&state, &headers) {
        tracing::warn!("WebSocket connection rejected: missing or invalid daemon token");
        return (StatusCode::FORBIDDEN, "invalid daemon token").into_response();
    }

    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(mut socket: WebSocket, state: Arc<DaemonState>) {
    while let Some(Ok(msg)) = socket.next().await {
        if let Message::Text(text) = msg {
            tracing::info!("{}", spicetify::fl!("rpc-received", msg = text.as_str()));
            let ctx = state.ctx.load();
            match protocol::handle(&ctx, &text) {
                Ok(res) if !res.is_empty() => {
                    if let Err(e) = socket.send(Message::Text(res.into())).await {
                        tracing::warn!(error = %e, "failed to send ws message");
                    }
                }
                Err(e) => {
                    tracing::warn!("{}", spicetify::fl!("protocol-error", err = e.to_string()));
                }
                _ => {}
            }
        }
    }
}

async fn shutdown_handler(State(state): State<Arc<DaemonState>>) -> impl IntoResponse {
    tracing::info!("{}", spicetify::fl!("shutdown-requested"));
    state.shutdown.notify_waiters();
    (StatusCode::ACCEPTED, spicetify::fl!("daemon-stopping-resp"))
}
