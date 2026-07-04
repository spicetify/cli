use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

pub fn from_error(err: &anyhow::Error) -> Response {
    let status = spicetify::error::get_http_status(err)
        .and_then(|s| StatusCode::from_u16(s).ok())
        .unwrap_or(StatusCode::BAD_GATEWAY);
    (status, spicetify::error::format_chain(err)).into_response()
}
