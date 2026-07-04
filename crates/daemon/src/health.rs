use std::sync::Arc;

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use serde_json::json;

use crate::server::DaemonState;

pub async fn handler(State(state): State<Arc<DaemonState>>) -> impl IntoResponse {
    let ctx = state.ctx.load_full();

    (
        StatusCode::OK,
        Json(json!({
            "daemon": "running",
            "version": spicetify::VERSION,
            "uptime_secs": state.startup.elapsed().as_secs(),
            "watchers": { "apps": true, "config": true },
            "spotify_detected": ctx.spotify_exec_path.is_file(),
        })),
    )
        .into_response()
}
