use std::collections::HashMap;
use std::sync::Arc;

use axum::Json;
use axum::body::Body;
use axum::extract::{Path, Request, State};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use futures_util::StreamExt;
use percent_encoding::{AsciiSet, NON_ALPHANUMERIC, percent_encode};

use crate::routes::ALLOWED_ORIGIN;
use crate::server::DaemonState;

const MAX_REQUEST_BODY: usize = 8 * 1024 * 1024;

pub const PATH_ESCAPE: &AsciiSet =
    &NON_ALPHANUMERIC.remove(b'-').remove(b'.').remove(b'_').remove(b'~');

const DEFAULT_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                                  (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

const INFRA_HEADERS: &[&str] = &[
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
    "forwarded",
    "x-real-ip",
    "content-length",
];

pub async fn handler(
    State(state): State<Arc<DaemonState>>,
    Path(url): Path<String>,
    method: Method,
    headers: HeaderMap,
    request: Request,
) -> Response {
    if method == Method::OPTIONS {
        return cors_preflight();
    }

    let Ok(target) = url::Url::parse(&url) else {
        return (StatusCode::BAD_REQUEST, spicetify::fl!("proxy-invalid-url")).into_response();
    };

    let Ok(body_bytes) = axum::body::to_bytes(request.into_body(), MAX_REQUEST_BODY).await else {
        return (StatusCode::PAYLOAD_TOO_LARGE, spicetify::fl!("proxy-invalid-body"))
            .into_response();
    };

    let upstream = build_upstream_request(&state.client, method, target, body_bytes, &headers);

    let Ok(upstream) = upstream.send().await else {
        return (StatusCode::BAD_GATEWAY, spicetify::fl!("proxy-request-failed")).into_response();
    };

    let status = upstream.status();
    let upstream_headers = upstream.headers().clone();

    let stream = upstream.bytes_stream();
    let body = Body::from_stream(stream.map(|chunk| {
        chunk.map_err(|e| spicetify::error::http_error(502, format!("upstream body error: {e}")))
    }));

    let mut response = match Response::builder().status(status).body(body) {
        Ok(r) => r,
        Err(e) => {
            return (StatusCode::BAD_GATEWAY, format!("response builder error: {e}"))
                .into_response();
        }
    };
    apply_response_headers(response.headers_mut(), &upstream_headers);
    response
}

fn cors_preflight() -> Response {
    let mut headers = HeaderMap::new();
    apply_cors(&mut headers);
    let _ = headers.insert(
        "access-control-allow-methods",
        HeaderValue::from_static("GET, POST, PUT, DELETE, PATCH, OPTIONS"),
    );
    let _ = headers.insert(
        "access-control-allow-headers",
        HeaderValue::from_static("content-type, x-set-headers"),
    );
    let _ = headers.insert("access-control-max-age", HeaderValue::from_static("86400"));
    (StatusCode::NO_CONTENT, headers, Json(serde_json::json!({}))).into_response()
}

pub fn apply_cors(h: &mut HeaderMap) {
    let _ = h.insert("access-control-allow-origin", HeaderValue::from_static(ALLOWED_ORIGIN));
    let _ = h.insert("access-control-allow-credentials", HeaderValue::from_static("true"));
    let _ = h.insert("access-control-allow-private-network", HeaderValue::from_static("true"));
    let _ = h.insert("access-control-expose-headers", HeaderValue::from_static("*"));
    let _ = h.insert("vary", HeaderValue::from_static("Origin"));
}

fn build_upstream_request(
    client: &reqwest::Client,
    method: Method,
    target: url::Url,
    body_bytes: axum::body::Bytes,
    headers: &HeaderMap,
) -> reqwest::RequestBuilder {
    let mut upstream = client.request(method, target).body(body_bytes);

    let mut has_user_agent = false;
    for (name, value) in headers {
        if name == "host" || name == "x-set-headers" {
            continue;
        }
        let name_str = name.as_str();
        if INFRA_HEADERS.iter().any(|h| name_str.eq_ignore_ascii_case(h)) {
            continue;
        }
        if name_str.eq_ignore_ascii_case("user-agent") {
            has_user_agent = true;
        }
        upstream = upstream.header(name, value);
    }
    if let Some(raw) = headers.get("x-set-headers")
        && let Ok(raw) = raw.to_str()
        && let Ok(extra) = serde_json::from_str::<HashMap<String, String>>(raw)
    {
        for (k, v) in extra {
            if k.eq_ignore_ascii_case("user-agent") || k.eq_ignore_ascii_case("x-user-agent") {
                has_user_agent = true;
                upstream = upstream.header("User-Agent", if v == "undefined" { "" } else { &v });
            } else {
                upstream =
                    if v == "undefined" { upstream.header(&k, "") } else { upstream.header(&k, v) };
            }
        }
    }
    if !has_user_agent {
        upstream = upstream.header("User-Agent", DEFAULT_USER_AGENT);
    }
    upstream
}

fn apply_response_headers(h: &mut HeaderMap, upstream_headers: &HeaderMap) {
    apply_cors(h);
    for (k, v) in upstream_headers {
        if k.as_str().eq_ignore_ascii_case("set-cookie") {
            continue;
        }
        let _ = h.insert(k, v.clone());
    }
    let cookie_vals: Vec<_> =
        upstream_headers.get_all("set-cookie").iter().filter_map(|v| v.to_str().ok()).collect();
    for val in &cookie_vals {
        if let Ok(v) = HeaderValue::from_str(val) {
            let _ = h.append("x-set-cookie", v);
        }
    }
    if let Some(loc) = h.get("location").and_then(|v| v.to_str().ok()) {
        let escaped = percent_encode(loc.as_bytes(), PATH_ESCAPE);
        let redirect = format!("http://{}/proxy/{escaped}", spicetify::daemon::bind_addr());
        if let Ok(v) = HeaderValue::from_str(&redirect) {
            let _ = h.insert("location", v);
        }
    }
}
