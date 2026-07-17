use std::sync::Arc;

use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{any, get, post};
use axum::{Json, Router};
use futures_util::StreamExt;
use spicetify::commands::protocol;

use crate::server::DaemonState;
use crate::{error, health, proxy};

pub const ALLOWED_ORIGIN: &str = "https://xpui.app.spotify.com";

pub fn build(state: Arc<DaemonState>) -> Router {
    Router::new()
        .route("/health", get(health::handler))
        .route("/rpc", get(ws_handler))
        .route("/shutdown", post(shutdown_handler))
        .route("/self-update", post(self_update_handler))
        .route("/proxy/{*url}", any(proxy::handler))
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

async fn self_update_handler() -> impl IntoResponse {
    let current_version = spicetify::VERSION;

    match tokio::task::spawn_blocking(spicetify::update::check_for_update).await {
        Ok(Ok(Some(release))) => {
            let version = release.version();
            tracing::info!(%version, %current_version, "self-update check: update available");
            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "status": "ready",
                    "version": version,
                    "current_version": current_version,
                })),
            )
                .into_response()
        }
        Ok(Ok(None)) => {
            tracing::info!(%current_version, "self-update check: up to date");
            (
                StatusCode::OK,
                Json(serde_json::json!({"status": "up_to_date", "version": current_version})),
            )
                .into_response()
        }
        Ok(Err(e)) => {
            tracing::warn!(error = %e, "self-update check failed");
            error::from_error(&e)
        }
        Err(e) => {
            tracing::warn!(error = %e, "self-update spawn_blocking failed");
            error::from_error(&e.into())
        }
    }
}
