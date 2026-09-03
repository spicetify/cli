// Fetches classmaps from the spicetify/classmaps repo into the config root, so
// a new Spotify build is supported by publishing a classmap rather than by
// releasing a CLI. `index.json` names each key's files and their sha256; a
// download that does not match its digest is discarded.

use std::collections::BTreeMap;
use std::path::Path;

use anyhow::Context as _;
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
    /// The exposure patch set (module/expose.rs), published at the repo root.
    #[serde(default)]
    expose: Option<FileRef>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IndexEntry {
    classmap: FileRef,
    #[serde(default)]
    meta: Option<FileRef>,
    #[serde(default)]
    css_map_overlay: Option<FileRef>,
    #[serde(default)]
    spotify_version: Option<String>,
    #[serde(default)]
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FileRef {
    file: String,
    sha256: String,
}

/// Returns the exact classmap filename named by the successfully-consumed
/// cached index. Developer/binary roots without that index keep stage's legacy
/// discovery fallback.
pub(crate) enum IndexedClassmapFile {
    NoIndex,
    Absent,
    File(String),
}

pub(crate) fn indexed_classmap_file(config_root: &Path, key: &str) -> IndexedClassmapFile {
    let Ok(raw) = std::fs::read(config_root.join("classmaps").join("index.json")) else {
        return IndexedClassmapFile::NoIndex;
    };
    let Ok(index) = serde_json::from_slice::<Index>(&raw) else {
        return IndexedClassmapFile::NoIndex;
    };
    let Some(entry) = index.keys.get(key) else {
        return IndexedClassmapFile::Absent;
    };
    let file = &entry.classmap.file;
    if is_plain_file_name(file) {
        IndexedClassmapFile::File(file.clone())
    } else {
        IndexedClassmapFile::Absent
    }
}

/// Downloads the classmap for `wanted_key`, or the newest published key below
/// it sharing the same major.minor. Returns the key that was cached.
pub(crate) fn fetch_classmap(config_root: &Path, wanted_key: &str) -> Result<String> {
    let client = crate::http::blocking_client(20)?;

    let index_bytes = client
        .get(format!("{}/index.json", base_url()))
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .and_then(reqwest::blocking::Response::bytes)
        .map_err(|e| anyhow::anyhow!("cannot fetch the classmap index: {e}"))?;
    let index: Index = serde_json::from_slice(&index_bytes)
        .map_err(|e| anyhow::anyhow!("malformed classmap index: {e}"))?;

    // The patch set is independent of the key: cache it before key
    // resolution so a build no classmap covers still gets current patches.
    if let Some(expose) = &index.expose {
        let cache_root = config_root.join("classmaps");
        if expose.file != super::expose::EXPOSE_FILE {
            tracing::warn!(
                "refusing an expose entry not named {}: {}",
                super::expose::EXPOSE_FILE,
                expose.file
            );
        } else if let Err(e) = std::fs::create_dir_all(&cache_root)
            .context("creating the classmap cache directory")
            .and_then(|()| cache_file(&client, None, expose, &cache_root))
        {
            tracing::warn!(error = %e, "could not refresh the exposure patches; using what is cached");
        }
    }

    let target: u64 =
        wanted_key.parse().map_err(|_| anyhow::anyhow!("malformed classmap key {wanted_key}"))?;

    let key = if index.keys.contains_key(wanted_key) {
        wanted_key.to_string()
    } else {
        let published: Vec<u64> = index.keys.keys().filter_map(|k| k.parse().ok()).collect();
        super::stage::pick_fallback_key(&published, target)
            .map(|k| k.to_string())
            .ok_or_else(|| anyhow::anyhow!("no published classmap covers {wanted_key}"))?
    };

    // The index decides both path segments, so neither is trusted to stay
    // inside the cache directory without checking.
    if !is_plain_key(&key) {
        anyhow::bail!("refusing a classmap key that is not a plain number: {key}");
    }

    let entry = index.keys.get(&key).ok_or_else(|| anyhow::anyhow!("key {key} left the index"))?;

    let files: Vec<&FileRef> =
        [Some(&entry.classmap), entry.meta.as_ref(), entry.css_map_overlay.as_ref()]
            .into_iter()
            .flatten()
            .collect();
    for file in &files {
        if !is_plain_file_name(&file.file) {
            anyhow::bail!("refusing a classmap file name that is not a plain file: {}", file.file);
        }
    }

    let dest = config_root.join("classmaps").join(&key);
    std::fs::create_dir_all(&dest)?;

    for file in files {
        cache_file(&client, Some(&key), file, &dest)?;
    }

    // Keep the successfully-consumed index beside the cache. Staging uses it
    // to distinguish a published, verified map from an arbitrary adjacent
    // META.json and to expose the newest verified Spotify build to Manager.
    std::fs::write(config_root.join("classmaps").join("index.json"), &index_bytes)?;

    Ok(key)
}

#[derive(Debug, Default, PartialEq, Eq)]
pub(crate) struct ClassmapSupport {
    /// The three-part Spotify line the selected classmap was verified against.
    pub selected_spotify: Option<String>,
    /// The newest three-part Spotify line with a verified published entry.
    pub latest_spotify: Option<String>,
}

/// Derives support only from the cached published index. The selected map and
/// its META must still match the index digests and bind back to `selected_key`;
/// this prevents a copied/stale adjacent META from asserting support for a
/// developer override or candidate map.
pub(crate) fn classmap_support(
    config_root: &Path,
    selected_key: &str,
    classmap_path: &Path,
) -> ClassmapSupport {
    let Ok(raw) = std::fs::read(config_root.join("classmaps").join("index.json")) else {
        return ClassmapSupport::default();
    };
    let Ok(index) = serde_json::from_slice::<Index>(&raw) else {
        return ClassmapSupport::default();
    };

    let latest_spotify = index
        .keys
        .iter()
        .filter(|(key, entry)| entry_is_verified_for_key(key, entry))
        .max_by_key(|(key, _)| key.parse::<u64>().unwrap_or_default())
        .and_then(|(_, entry)| entry.spotify_version.as_deref())
        .and_then(super::stage::spotify_version_line);

    let selected_spotify = index
        .keys
        .get(selected_key)
        .filter(|entry| entry_is_verified_for_key(selected_key, entry))
        .and_then(|entry| verified_selected_entry(selected_key, entry, classmap_path))
        .and_then(|spotify| super::stage::spotify_version_line(&spotify));

    ClassmapSupport { selected_spotify, latest_spotify }
}

fn entry_is_verified_for_key(key: &str, entry: &IndexEntry) -> bool {
    entry.status.as_deref() == Some("verified")
        && entry
            .spotify_version
            .as_deref()
            .and_then(super::stage::classmap_key_for_version)
            .as_deref()
            == Some(key)
}

fn verified_selected_entry(key: &str, entry: &IndexEntry, classmap_path: &Path) -> Option<String> {
    let classmap_bytes = std::fs::read(classmap_path).ok()?;
    if digest(&classmap_bytes) != entry.classmap.sha256.to_lowercase() {
        return None;
    }
    let meta_ref = entry.meta.as_ref()?;
    if !is_plain_file_name(&meta_ref.file) {
        return None;
    }
    let meta_bytes = std::fs::read(classmap_path.parent()?.join(&meta_ref.file)).ok()?;
    if digest(&meta_bytes) != meta_ref.sha256.to_lowercase() {
        return None;
    }
    let meta: serde_json::Value = serde_json::from_slice(&meta_bytes).ok()?;
    let spotify = meta.get("spotify_version")?.as_str()?;
    (meta.get("status")?.as_str()? == "verified"
        && meta.get("classmap_key")?.as_str()? == key
        && entry.spotify_version.as_deref() == Some(spotify)
        && super::stage::classmap_key_for_version(spotify).as_deref() == Some(key))
    .then(|| spotify.to_string())
}

/// Classmap keys are digits only, so they cannot escape the cache directory or
/// reshape the download URL.
fn is_plain_key(key: &str) -> bool {
    !key.is_empty() && key.len() <= 12 && key.bytes().all(|b| b.is_ascii_digit())
}

/// A single path component: no separators, no traversal, no absolute path.
fn is_plain_file_name(name: &str) -> bool {
    !name.contains('\\')
        && Path::new(name).file_name().and_then(std::ffi::OsStr::to_str) == Some(name)
}

/// `key` is the classmap key directory the file lives under; `None` is a file
/// published at the repo root (the exposure patch set).
fn cache_file(
    client: &reqwest::blocking::Client,
    key: Option<&str>,
    file: &FileRef,
    dest: &Path,
) -> Result<()> {
    let path = dest.join(&file.file);
    if path.is_file()
        && std::fs::read(&path).is_ok_and(|bytes| digest(&bytes) == file.sha256.to_lowercase())
    {
        return Ok(());
    }

    let url = match key {
        Some(key) => format!("{}/{key}/{}", base_url(), file.file),
        None => format!("{}/{}", base_url(), file.file),
    };
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
    if let Some(key) = key {
        tracing::info!("cached classmap file {key}/{}", file.file);
    } else {
        tracing::info!("cached {}", file.file);
    }
    Ok(())
}

pub(crate) fn digest(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir()
            .join(format!("spicetify-classmap-support-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("scratch dir");
        dir
    }

    #[test]
    fn rejects_keys_that_are_not_plain_numbers() {
        assert!(is_plain_key("1020094"));
        assert!(!is_plain_key(""));
        assert!(!is_plain_key(".."));
        assert!(!is_plain_key("../../etc"));
        assert!(!is_plain_key("1020094/.."));
        assert!(!is_plain_key("/etc"));
    }

    #[test]
    fn rejects_file_names_that_escape_the_cache_dir() {
        assert!(is_plain_file_name("classmap-19f856aefd5.json"));
        assert!(is_plain_file_name("META.json"));
        assert!(!is_plain_file_name(".."));
        assert!(!is_plain_file_name("../../../../tmp/evil"));
        assert!(!is_plain_file_name("/etc/passwd"));
        assert!(!is_plain_file_name("sub/dir.json"));
        assert!(!is_plain_file_name("..\\..\\evil"));
        assert!(!is_plain_file_name(""));
    }

    #[test]
    fn support_is_bound_to_the_published_index_and_selected_files() {
        let root = scratch("verified");
        let selected = root.join("classmaps/1020096");
        std::fs::create_dir_all(&selected).expect("selected dir");
        let classmap = br#"{"main":{}}"#;
        let meta =
            br#"{"spotify_version":"1.2.96.518","classmap_key":"1020096","status":"verified"}"#;
        std::fs::write(selected.join("classmap.json"), classmap).expect("classmap");
        std::fs::write(selected.join("META.json"), meta).expect("meta");
        let mut index = serde_json::json!({
            "keys": {
                "1020096": {
                    "classmap": { "file": "classmap.json", "sha256": digest(classmap) },
                    "meta": { "file": "META.json", "sha256": digest(meta) },
                    "spotifyVersion": "1.2.96.518",
                    "status": "verified"
                },
                "1020097": {
                    "classmap": { "file": "classmap.json", "sha256": "unused" },
                    "spotifyVersion": "1.2.97.10",
                    "status": "verified"
                }
            }
        });
        std::fs::write(
            root.join("classmaps/index.json"),
            serde_json::to_vec(&index).expect("index json"),
        )
        .expect("index");

        let support = classmap_support(&root, "1020096", &selected.join("classmap.json"));
        assert_eq!(support.selected_spotify.as_deref(), Some("1.2.96"));
        assert_eq!(support.latest_spotify.as_deref(), Some("1.2.97"));

        let stale_meta =
            br#"{"spotify_version":"1.2.96.518","classmap_key":"1020094","status":"verified"}"#;
        std::fs::write(selected.join("META.json"), stale_meta).expect("stale meta");
        index["keys"]["1020096"]["meta"]["sha256"] = digest(stale_meta).into();
        std::fs::write(
            root.join("classmaps/index.json"),
            serde_json::to_vec(&index).expect("updated index json"),
        )
        .expect("updated index");
        let support = classmap_support(&root, "1020096", &selected.join("classmap.json"));
        assert_eq!(
            support.selected_spotify, None,
            "even an index-matching META cannot assert support for a different key"
        );
        assert_eq!(support.latest_spotify.as_deref(), Some("1.2.97"));

        std::fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn candidate_index_entries_never_count_as_supported() {
        let root = scratch("candidate");
        std::fs::create_dir_all(root.join("classmaps")).expect("classmaps dir");
        let index = serde_json::json!({
            "keys": {
                "1020097": {
                    "classmap": { "file": "classmap.json", "sha256": "unused" },
                    "spotifyVersion": "1.2.97.10",
                    "status": "candidate"
                }
            }
        });
        std::fs::write(
            root.join("classmaps/index.json"),
            serde_json::to_vec(&index).expect("index json"),
        )
        .expect("index");
        assert_eq!(
            classmap_support(&root, "1020097", &root.join("classmap.json")),
            ClassmapSupport::default()
        );
        std::fs::remove_dir_all(root).expect("cleanup");
    }
}
