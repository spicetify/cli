use std::sync::Arc;
use std::sync::atomic::Ordering;

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use spicetify::daemon::HealthInfo;

use crate::server::DaemonState;

pub async fn handler(State(state): State<Arc<DaemonState>>) -> impl IntoResponse {
    let ctx = state.ctx.load_full();

    let info = HealthInfo {
        version: spicetify::VERSION.to_string(),
        uptime_secs: state.startup.elapsed().as_secs(),
        apps_watcher_active: state.apps_watcher_active.load(Ordering::Acquire),
        config_watcher_active: state.config_watcher_active.load(Ordering::Acquire),
        spotify_detected: ctx.spotify_exec.is_file(),
    };

    (StatusCode::OK, Json(info)).into_response()
}
