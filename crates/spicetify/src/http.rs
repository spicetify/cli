use std::time::Duration;

use anyhow::Context;
use reqwest::header::{HeaderMap, HeaderValue};

use crate::error::Result;

const UA: &str = concat!("spicetify/", env!("CARGO_PKG_VERSION"));

pub fn client(timeout_secs: u64) -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent(UA)
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .context("failed to build HTTP client")
}

pub fn blocking_client(timeout_secs: u64) -> Result<reqwest::blocking::Client> {
    reqwest::blocking::Client::builder()
        .user_agent(UA)
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .context("failed to build blocking HTTP client")
}

pub fn github_client() -> Result<reqwest::Client> {
    let mut headers = HeaderMap::new();
    drop(headers.insert(
        reqwest::header::ACCEPT,
        HeaderValue::from_static("application/vnd.github.v3+json"),
    ));
    reqwest::Client::builder()
        .user_agent(UA)
        .default_headers(headers)
        .timeout(Duration::from_secs(15))
        .build()
        .context("failed to build GitHub HTTP client")
}

pub fn download_client() -> Result<reqwest::Client> {
    client(300)
}

pub fn daemon_local_client() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .expect("failed to build daemon local blocking client")
}

pub fn proxy_client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent(UA)
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none())
        .cookie_store(true)
        .build()
        .context("failed to build proxy HTTP client")
}
