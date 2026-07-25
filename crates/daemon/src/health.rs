use std::sync::Arc;
use std::sync::atomic::Ordering;

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use serde_json::json;

use crate::server::DaemonState;

pub async fn handler(State(state): State<Arc<DaemonState>>) -> impl IntoResponse {
    let ctx = state.ctx.load_full();

    let apps_active = state.apps_watcher_active.load(Ordering::Acquire);
    let config_active = state.config_watcher_active.load(Ordering::Acquire);

    (
        StatusCode::OK,
        Json(json!({
            "daemon": "running",
            "version": spicetify::VERSION,
            "uptime_secs": state.startup.elapsed().as_secs(),
            "watchers": { "apps": apps_active, "config": config_active },
            "spotify_detected": ctx.spotify_exec.is_file(),
        })),
    )
        .into_response()
}
