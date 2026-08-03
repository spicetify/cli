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
const GITHUB_RELEASES_URL: &str = "https://api.github.com/repos/veryboringhwl/hooks/releases";

static BLOCKING_CLIENT: LazyLock<reqwest::blocking::Client> = LazyLock::new(|| {
    crate::http::blocking_client(30).expect("failed to create blocking HTTP client")
});

static ASYNC_CLIENT: LazyLock<reqwest::Client> =
    LazyLock::new(|| crate::http::client(30).expect("failed to create async HTTP client"));

type CacheEntry = Option<(Instant, Vec<HookSet>)>;

static HOOK_SETS_CACHE: LazyLock<Mutex<CacheEntry>> = LazyLock::new(|| Mutex::new(None));

#[must_use]
pub fn blocking_client() -> &'static reqwest::blocking::Client {
    &BLOCKING_CLIENT
}

fn check_cache() -> Option<Vec<HookSet>> {
    if let Ok(cache) = HOOK_SETS_CACHE.lock()
        && let Some((fetched_at, sets)) = &*cache
        && fetched_at.elapsed() < CACHE_TTL
    {
        Some(sets.clone())
    } else {
        None
    }
}

fn store_cache(sets: &[HookSet]) {
    if let Ok(mut cache) = HOOK_SETS_CACHE.lock() {
        *cache = Some((Instant::now(), sets.to_vec()));
    }
}

fn parse_releases(bytes: &[u8]) -> Result<Vec<HookSet>, anyhow::Error> {
    let releases: Vec<GitHubRelease> = serde_json::from_slice(bytes)
        .map_err(|e| anyhow::anyhow!("failed to parse releases: {e}"))?;
    Ok(releases.iter().filter_map(parse_release_entry).collect())
}

fn process_response(bytes: &[u8]) -> Result<Vec<HookSet>, anyhow::Error> {
    let sets = parse_releases(bytes)?;
    store_cache(&sets);
    Ok(sets)
}

pub fn fetch_hook_sets() -> Result<Vec<HookSet>, anyhow::Error> {
    if let Some(sets) = check_cache() {
        return Ok(sets);
    }

    let response = BLOCKING_CLIENT
        .get(GITHUB_RELEASES_URL)
        .send()
        .map_err(|e| anyhow::anyhow!("failed to fetch releases: {e}"))?;

    let bytes =
        response.bytes().map_err(|e| anyhow::anyhow!("failed to read release body: {e}"))?;

    process_response(&bytes)
}

pub async fn fetch_hook_sets_async() -> Result<Vec<HookSet>, anyhow::Error> {
    if let Some(sets) = check_cache() {
        return Ok(sets);
    }

    let response = ASYNC_CLIENT
        .get(GITHUB_RELEASES_URL)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("failed to fetch releases: {e}"))?;

    let bytes =
        response.bytes().await.map_err(|e| anyhow::anyhow!("failed to read release body: {e}"))?;

    process_response(&bytes)
}

fn parse_release_entry(release: &GitHubRelease) -> Option<HookSet> {
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
