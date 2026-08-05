use std::collections::HashMap;
use std::sync::Arc;

use axum::Json;
use axum::body::Body;
use axum::extract::{Path, Request, State};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use percent_encoding::{AsciiSet, NON_ALPHANUMERIC, percent_encode};
use tokio_stream::StreamExt;

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

pub async fn status() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "message": format!("Proxy is working as expected (v{})", spicetify::VERSION)
    }))
}

pub async fn handler(
    State(state): State<Arc<DaemonState>>,
    Path(url): Path<String>,
    method: Method,
    headers: HeaderMap,
    request: Request,
) -> Response {
    if method == Method::OPTIONS {
        return StatusCode::NO_CONTENT.into_response();
    }

    let Some(target) = resolve_target(&url, request.uri().query()) else {
        tracing::warn!(%url, "proxy received invalid URL");
        return error_response(StatusCode::BAD_REQUEST, spicetify::fl!("proxy-invalid-url"));
    };

    let Ok(body_bytes) = axum::body::to_bytes(request.into_body(), MAX_REQUEST_BODY).await else {
        tracing::warn!(%target, "proxy request body exceeds {} bytes limit", MAX_REQUEST_BODY);
        return error_response(StatusCode::PAYLOAD_TOO_LARGE, spicetify::fl!("proxy-invalid-body"));
    };

    let upstream = build_upstream_request(&state.client, method, &target, body_bytes, &headers);

    let Ok(upstream) = upstream.send().await else {
        tracing::warn!(%target, "upstream proxy request failed");
        return error_response(StatusCode::BAD_GATEWAY, spicetify::fl!("proxy-request-failed"));
    };

    let status = upstream.status();
    let upstream_headers = upstream.headers().clone();

    let stream = upstream.bytes_stream();
    let body = Body::from_stream(stream.map(|chunk| {
        chunk.map_err(|e| crate::error::http_error(502, format!("upstream body error: {e}")))
    }));

    let mut response = match Response::builder().status(status).body(body) {
        Ok(r) => r,
        Err(e) => {
            return error_response(StatusCode::BAD_GATEWAY, format!("response builder error: {e}"));
        }
    };
    apply_response_headers(response.headers_mut(), &upstream_headers);
    response
}

fn error_response(status: StatusCode, message: String) -> Response {
    (status, message).into_response()
}

// The target may arrive percent-encoded (the whole URL, query included, lands
// in the path) or raw, in which case the router splits the target's own query
// off into the request query. Re-attaching it keeps both spellings equivalent,
// so callers can substitute a URL into the template without encoding it and
// still reach the right resource instead of silently querying nothing.
fn resolve_target(path: &str, query: Option<&str>) -> Option<url::Url> {
    let mut target = url::Url::parse(path).ok()?;
    if target.query().is_none()
        && let Some(query) = query
    {
        target.set_query(Some(query));
    }
    Some(target)
}

fn build_upstream_request(
    client: &reqwest::Client,
    method: Method,
    target: &url::Url,
    body_bytes: axum::body::Bytes,
    headers: &HeaderMap,
) -> reqwest::RequestBuilder {
    let mut upstream = client.request(method, target.as_str()).body(body_bytes);

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
    for (k, v) in upstream_headers {
        let name = k.as_str();
        if name.eq_ignore_ascii_case("set-cookie") || name.starts_with("access-control-") {
            continue;
        }
        drop(h.insert(k, v.clone()));
    }
    let cookie_vals: Vec<_> =
        upstream_headers.get_all("set-cookie").iter().filter_map(|v| v.to_str().ok()).collect();
    for val in &cookie_vals {
        if let Ok(v) = HeaderValue::from_str(val)
            && !h.append("x-set-cookie", v)
        {
            tracing::debug!("failed to append x-set-cookie header");
        }
    }
    if let Some(loc) = h.get("location").and_then(|v| v.to_str().ok()) {
        let escaped = percent_encode(loc.as_bytes(), PATH_ESCAPE);
        let redirect = format!("http://{}/proxy/{escaped}", spicetify::daemon::bind_addr());
        if let Ok(v) = HeaderValue::from_str(&redirect) {
            drop(h.insert("location", v));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RAW: &str = "https://lrclib.net/api/search";
    const ENCODED: &str = "https://lrclib.net/api/search?q=test";

    #[test]
    fn raw_target_keeps_the_query_the_router_split_off() {
        let target = resolve_target(RAW, Some("q=test")).expect("valid target");
        assert_eq!(target.as_str(), ENCODED);
    }

    #[test]
    fn encoded_and_raw_targets_reach_the_same_url() {
        let encoded = resolve_target(ENCODED, None).expect("valid target");
        let raw = resolve_target(RAW, Some("q=test")).expect("valid target");
        assert_eq!(encoded, raw);
    }

    #[test]
    fn a_target_carrying_its_own_query_is_left_alone() {
        let target = resolve_target(ENCODED, Some("injected=1")).expect("valid target");
        assert_eq!(target.query(), Some("q=test"));
    }

    #[test]
    fn a_queryless_request_leaves_a_queryless_target() {
        let target = resolve_target(RAW, None).expect("valid target");
        assert_eq!(target.as_str(), RAW);
    }

    #[test]
    fn a_non_url_target_is_rejected() {
        assert!(resolve_target("not-a-url", None).is_none());
    }
}
