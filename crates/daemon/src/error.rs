use std::fmt;

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

pub fn from_error(err: &anyhow::Error) -> Response {
    let status = get_http_status(err)
        .and_then(|s| StatusCode::from_u16(s).ok())
        .unwrap_or(StatusCode::BAD_GATEWAY);
    (status, spicetify::error::format_chain(err)).into_response()
}

#[derive(Debug)]
struct HttpStatusError {
    status: u16,
    source: anyhow::Error,
}

impl fmt::Display for HttpStatusError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.source)
    }
}

impl std::error::Error for HttpStatusError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        Some(self.source.as_ref())
    }
}

pub(crate) fn http_error(status: u16, msg: impl fmt::Display) -> anyhow::Error {
    HttpStatusError { status, source: anyhow::anyhow!("{msg}") }.into()
}

fn get_http_status(err: &anyhow::Error) -> Option<u16> {
    for cause in err.chain() {
        if let Some(hse) = cause.downcast_ref::<HttpStatusError>() {
            return Some(hse.status);
        }
    }
    None
}
