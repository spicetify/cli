use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use regex::Regex;
use serde::Deserialize;

#[derive(Debug, Clone)]
pub struct HookSet {
    pub hooks_version: String,
    pub spotify_version_req: String,
    pub download_url: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    body: Option<String>,
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    browser_download_url: String,
}

static MIN_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?m)^spotify_min:\s*(\S+)").expect("valid regex"));
static MAX_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?m)^spotify_max:\s*(\S+)").expect("valid regex"));

impl HookSet {
    #[must_use]
    pub fn display_label(&self) -> String {
        let range_desc = if self.spotify_version_req.starts_with(">=")
            && !self.spotify_version_req.contains(',')
        {
            let min = self.spotify_version_req.strip_prefix(">=").unwrap_or("");
            format!("Spotify {min} – latest")
        } else {
            let cleaned = self
                .spotify_version_req
                .replace(">=", "")
                .replace("<=", "")
                .replace(',', " –")
                .trim()
                .to_string();
            format!("Spotify {cleaned}")
        };
        format!("v{} ({})", self.hooks_version, range_desc)
    }

    #[must_use]
    pub fn matches_version(&self, version: &semver::Version) -> bool {
        semver::VersionReq::parse(&self.spotify_version_req).is_ok_and(|req| req.matches(version))
    }
}

const CACHE_TTL: Duration = Duration::from_secs(30);

static HTTP_CLIENT: LazyLock<reqwest::blocking::Client> = LazyLock::new(|| {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("spicetify")
        .build()
        .expect("failed to create HTTP client")
});

static ASYNC_HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("spicetify")
        .build()
        .expect("failed to create async HTTP client")
});

type CacheEntry = Option<(Instant, Vec<HookSet>)>;

static HOOK_SETS_CACHE: LazyLock<Mutex<CacheEntry>> = LazyLock::new(|| Mutex::new(None));

#[must_use]
pub fn http_client() -> &'static reqwest::blocking::Client {
    &HTTP_CLIENT
}

pub fn fetch_hook_sets() -> Result<Vec<HookSet>, anyhow::Error> {
    if let Ok(cache) = HOOK_SETS_CACHE.lock()
        && let Some((fetched_at, sets)) = &*cache
        && fetched_at.elapsed() < CACHE_TTL
    {
        return Ok(sets.clone());
    }

    let response = HTTP_CLIENT
        .get("https://api.github.com/repos/veryboringhwl/hooks/releases?per_page=10")
        .send()
        .map_err(|e| anyhow::anyhow!("failed to fetch releases: {e}"))?;

    let releases: Vec<GitHubRelease> =
        response.json().map_err(|e| anyhow::anyhow!("failed to parse releases: {e}"))?;

    let sets: Vec<HookSet> = releases.iter().filter_map(parse_release).collect();

    if let Ok(mut cache) = HOOK_SETS_CACHE.lock() {
        *cache = Some((Instant::now(), sets.clone()));
    }

    Ok(sets)
}

fn parse_release(release: &GitHubRelease) -> Option<HookSet> {
    let body = release.body.as_deref().unwrap_or("");

    let Some(min_caps) = MIN_RE.captures(body) else {
        tracing::debug!(
            tag = %release.tag_name,
            "skipping release: no spotify_min in body"
        );
        return None;
    };
    let spotify_min = min_caps.get(1).expect("regex has one capture").as_str().trim();

    let Some(max_caps) = MAX_RE.captures(body) else {
        tracing::debug!(
            tag = %release.tag_name,
            "skipping release: no spotify_max in body"
        );
        return None;
    };
    let spotify_max_raw = max_caps.get(1).expect("regex has one capture").as_str().trim();

    let spotify_version_req = if spotify_max_raw.eq_ignore_ascii_case("latest") {
        format!(">={spotify_min}")
    } else {
        format!(">={spotify_min}, <={spotify_max_raw}")
    };

    let hooks_version = release.tag_name.strip_prefix('v').unwrap_or(&release.tag_name);

    let Some(asset) = release.assets.iter().find(|a| a.name == "hooks.tar.zst") else {
        tracing::debug!(
            tag = %release.tag_name,
            "skipping release: no hooks.tar.zst asset"
        );
        return None;
    };

    Some(HookSet {
        hooks_version: hooks_version.to_string(),
        spotify_version_req,
        download_url: asset.browser_download_url.clone(),
    })
}

pub async fn fetch_hook_sets_async() -> Result<Vec<HookSet>, anyhow::Error> {
    if let Ok(cache) = HOOK_SETS_CACHE.lock()
        && let Some((fetched_at, sets)) = &*cache
        && fetched_at.elapsed() < CACHE_TTL
    {
        return Ok(sets.clone());
    }

    let response = ASYNC_HTTP_CLIENT
        .get("https://api.github.com/repos/veryboringhwl/hooks/releases")
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("failed to fetch releases: {e}"))?;

    let releases: Vec<GitHubRelease> =
        response.json().await.map_err(|e| anyhow::anyhow!("failed to parse releases: {e}"))?;

    let sets: Vec<HookSet> = releases.iter().filter_map(parse_release).collect();

    if let Ok(mut cache) = HOOK_SETS_CACHE.lock() {
        *cache = Some((Instant::now(), sets.clone()));
    }

    Ok(sets)
}
