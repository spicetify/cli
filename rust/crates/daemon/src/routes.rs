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
pub use spicetify::daemon::token::HEADER as TOKEN_HEADER;

/// Subprotocol prefix a browser uses to present the token on a WebSocket.
/// `fetch` can set headers and `WebSocket` cannot, so the handshake's
/// `Sec-WebSocket-Protocol` offer is the only channel the client page has.
pub const TOKEN_PROTOCOL_PREFIX: &str = "spicetify.token.";

/// Marks an RPC reply as a failure. The success replies are
/// `spicetify:<module>:1`, so a caller cannot otherwise tell an error from a
/// command that answers with nothing.
pub const ERROR_PREFIX: &str = "error:";

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

/// The token offered as a `Sec-WebSocket-Protocol` value, with the protocol
/// string it was carried in. The protocol has to be echoed on the response or
/// the browser fails the handshake.
fn offered_token(headers: &HeaderMap) -> Option<(String, String)> {
    headers
        .get("sec-websocket-protocol")
        .and_then(|v| v.to_str().ok())?
        .split(',')
        .map(str::trim)
        .find_map(|proto| {
            proto.strip_prefix(TOKEN_PROTOCOL_PREFIX).map(|tok| (proto.to_string(), tok.to_string()))
        })
}

/// Whether a WebSocket handshake is authorised, by header or by subprotocol.
/// Returns the subprotocol to echo, when that is how the token arrived.
fn ws_authorized(state: &DaemonState, headers: &HeaderMap) -> Option<Option<String>> {
    if authorized(state, headers) {
        return Some(None);
    }
    let expected = spicetify::daemon::token::read(&state.ctx.load().config_root)?;
    let (proto, presented) = offered_token(headers)?;
    spicetify::daemon::token::matches(&expected, &presented).then_some(Some(proto))
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

    let Some(echo) = ws_authorized(&state, &headers) else {
        tracing::warn!("WebSocket connection rejected: missing or invalid daemon token");
        return (StatusCode::FORBIDDEN, "invalid daemon token").into_response();
    };

    let ws = match echo {
        Some(proto) => ws.protocols([proto]),
        None => ws,
    };
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
                // A caller that acts on the reply cannot distinguish failure
                // from a command whose reply is empty by design, so failures
                // are reported rather than only logged.
                Err(e) => {
                    tracing::warn!("{}", spicetify::fl!("protocol-error", err = e.to_string()));
                    let reply = format!("{ERROR_PREFIX}{e}");
                    if let Err(e) = socket.send(Message::Text(reply.into())).await {
                        tracing::warn!(error = %e, "failed to send ws message");
                    }
                }
                _ => {}
            }
        }
    }
}

// A cross-origin POST is sent even when the browser refuses to let the page
// read the reply, so without a token any page the user visits could stop the
// daemon and silently disable auto re-apply.
async fn shutdown_handler(
    State(state): State<Arc<DaemonState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if !authorized(&state, &headers) {
        tracing::warn!("shutdown request rejected: missing or invalid daemon token");
        return (StatusCode::FORBIDDEN, "invalid daemon token".to_string()).into_response();
    }
    tracing::info!("{}", spicetify::fl!("shutdown-requested"));
    state.shutdown.notify_waiters();
    (StatusCode::ACCEPTED, spicetify::fl!("daemon-stopping-resp")).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn headers(protocols: &str) -> HeaderMap {
        let mut h = HeaderMap::new();
        let _ =
            h.insert("sec-websocket-protocol", HeaderValue::from_str(protocols).expect("header"));
        h
    }

    #[test]
    fn reads_the_token_from_a_subprotocol_offer() {
        let (proto, token) =
            offered_token(&headers("spicetify.token.abc123")).expect("token is offered");
        assert_eq!(token, "abc123");
        assert_eq!(proto, "spicetify.token.abc123", "the offer has to be echoed verbatim");
    }

    #[test]
    fn picks_the_token_out_of_a_multi_protocol_offer() {
        let (_, token) =
            offered_token(&headers("chat, spicetify.token.abc123, superchat")).expect("token");
        assert_eq!(token, "abc123");
    }

    #[test]
    fn ignores_an_offer_carrying_no_token() {
        assert!(offered_token(&headers("chat, superchat")).is_none());
        assert!(offered_token(&HeaderMap::new()).is_none());
    }
}
