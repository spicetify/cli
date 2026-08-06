// Fetches classmaps from the spicetify/classmaps repo into the config root, so
// a new Spotify build is supported by publishing a classmap rather than by
// releasing a CLI. `index.json` names each key's files and their sha256; a
// download that does not match its digest is discarded.

use std::collections::BTreeMap;
use std::path::Path;

use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::error::Result;

const BASE_URL: &str = "https://raw.githubusercontent.com/spicetify/classmaps/main";

/// Overrides the publish origin, for testing against a local copy.
fn base_url() -> String {
    std::env::var("SPICETIFY_CLASSMAPS_URL")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| BASE_URL.to_string())
}

#[derive(Debug, Deserialize)]
struct Index {
    keys: BTreeMap<String, IndexEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IndexEntry {
    classmap: FileRef,
    #[serde(default)]
    meta: Option<FileRef>,
    #[serde(default)]
    css_map_overlay: Option<FileRef>,
}

#[derive(Debug, Deserialize)]
struct FileRef {
    file: String,
    sha256: String,
}

/// Downloads the classmap for `wanted_key`, or the newest published key below
/// it sharing the same major.minor. Returns the key that was cached.
pub(crate) fn fetch_classmap(config_root: &Path, wanted_key: &str) -> Result<String> {
    let client = crate::http::blocking_client(20)?;

    let index: Index = client
        .get(format!("{}/index.json", base_url()))
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .and_then(reqwest::blocking::Response::json)
        .map_err(|e| anyhow::anyhow!("cannot fetch the classmap index: {e}"))?;

    let target: u64 = wanted_key
        .parse()
        .map_err(|_| anyhow::anyhow!("malformed classmap key {wanted_key}"))?;

    let key = if index.keys.contains_key(wanted_key) {
        wanted_key.to_string()
    } else {
        let published: Vec<u64> = index.keys.keys().filter_map(|k| k.parse().ok()).collect();
        super::stage::pick_fallback_key(&published, target)
            .map(|k| k.to_string())
            .ok_or_else(|| anyhow::anyhow!("no published classmap covers {wanted_key}"))?
    };

    let entry = index.keys.get(&key).ok_or_else(|| anyhow::anyhow!("key {key} left the index"))?;

    let dest = config_root.join("classmaps").join(&key);
    std::fs::create_dir_all(&dest)?;

    let files = [Some(&entry.classmap), entry.meta.as_ref(), entry.css_map_overlay.as_ref()];
    for file in files.into_iter().flatten() {
        cache_file(&client, &key, file, &dest)?;
    }

    Ok(key)
}

fn cache_file(
    client: &reqwest::blocking::Client,
    key: &str,
    file: &FileRef,
    dest: &Path,
) -> Result<()> {
    let path = dest.join(&file.file);
    if path.is_file()
        && std::fs::read(&path).is_ok_and(|bytes| digest(&bytes) == file.sha256.to_lowercase())
    {
        return Ok(());
    }

    let url = format!("{}/{key}/{}", base_url(), file.file);
    let bytes = client
        .get(&url)
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .and_then(reqwest::blocking::Response::bytes)
        .map_err(|e| anyhow::anyhow!("cannot download {url}: {e}"))?;

    let actual = digest(&bytes);
    if actual != file.sha256.to_lowercase() {
        anyhow::bail!(
            "checksum mismatch for {}: index says {}, download is {actual}",
            file.file,
            file.sha256
        );
    }

    std::fs::write(&path, &bytes)?;
    tracing::info!("cached classmap file {key}/{}", file.file);
    Ok(())
}

fn digest(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}
