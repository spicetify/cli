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
pub(crate) fn fetch_classmap(
    config_root: &Path,
    wanted_key: &str,
    no_cache: bool,
) -> Result<String> {
    fetch_classmap_from(config_root, wanted_key, &base_url(), no_cache)
}

fn fetch_classmap_from(
    config_root: &Path,
    wanted_key: &str,
    origin: &str,
    no_cache: bool,
) -> Result<String> {
    let mut nonce = [0; 16];
    let cache_bust = if no_cache {
        getrandom::fill(&mut nonce)?;
        Some(hex::encode(nonce))
    } else {
        None
    };
    let download = Download { client: crate::http::blocking_client(20)?, origin, cache_bust };
    let index_bytes = download
        .get("index.json")?
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
            if no_cache {
                anyhow::bail!(
                    "refusing an expose entry not named {}: {}",
                    super::expose::EXPOSE_FILE,
                    expose.file
                );
            }
            tracing::warn!(
                "refusing an expose entry not named {}: {}",
                super::expose::EXPOSE_FILE,
                expose.file
            );
        } else if let Err(e) = std::fs::create_dir_all(&cache_root)
            .context("creating the classmap cache directory")
            .and_then(|()| download.cache_file(None, expose, &cache_root))
        {
            if no_cache {
                return Err(e.context("could not refresh the exposure patches"));
            }
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
        download.cache_file(Some(&key), file, &dest)?;
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

#[derive(Debug)]
struct Download<'a> {
    client: reqwest::blocking::Client,
    origin: &'a str,
    cache_bust: Option<String>,
}

impl Download<'_> {
    fn get(&self, path: &str) -> Result<reqwest::blocking::RequestBuilder> {
        let mut url = url::Url::parse(&format!("{}/{path}", self.origin))?;
        if let Some(nonce) = &self.cache_bust {
            // A header alone does not bypass GitHub's raw-content CDN cache.
            let _ = url.query_pairs_mut().append_pair("_spicetify_refresh", nonce);
        }
        let request = self.client.get(url);
        Ok(if self.cache_bust.is_some() {
            request.header(reqwest::header::CACHE_CONTROL, "no-cache")
        } else {
            request
        })
    }

    // A missing key addresses root-level exposure patches.
    fn cache_file(&self, key: Option<&str>, file: &FileRef, dest: &Path) -> Result<()> {
        let path = dest.join(&file.file);
        if self.cache_bust.is_none()
            && path.is_file()
            && std::fs::read(&path).is_ok_and(|bytes| digest(&bytes) == file.sha256.to_lowercase())
        {
            return Ok(());
        }

        let url = match key {
            Some(key) => format!("{key}/{}", file.file),
            None => file.file.clone(),
        };
        let bytes = self
            .get(&url)?
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

    fn serve(
        replies: Vec<(&'static str, Vec<u8>)>,
    ) -> (String, std::thread::JoinHandle<Vec<String>>) {
        use std::io::{Read, Write};
        use std::time::{Duration, Instant};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind fixture");
        listener.set_nonblocking(true).expect("nonblocking fixture");
        let origin = format!("http://{}", listener.local_addr().expect("fixture address"));
        let worker = std::thread::spawn(move || {
            let mut requests = Vec::new();
            for (status, body) in replies {
                let deadline = Instant::now() + Duration::from_secs(5);
                let mut stream = loop {
                    match listener.accept() {
                        Ok((stream, _)) => break stream,
                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            assert!(Instant::now() < deadline, "missing fixture request");
                            std::thread::sleep(Duration::from_millis(10));
                        }
                        Err(e) => unreachable!("fixture accept failed: {e}"),
                    }
                };
                stream.set_nonblocking(false).expect("blocking fixture stream");
                stream.set_read_timeout(Some(Duration::from_secs(5))).expect("read timeout");
                let mut request = Vec::new();
                while !request.ends_with(b"\r\n\r\n") {
                    let mut byte = [0];
                    stream.read_exact(&mut byte).expect("request headers");
                    request.extend(byte);
                }
                requests.push(String::from_utf8(request).expect("HTTP headers"));
                write!(
                    stream,
                    "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                )
                .expect("response headers");
                stream.write_all(&body).expect("response body");
            }
            requests
        });
        (origin, worker)
    }

    #[test]
    fn no_cache_refreshes_the_index_and_every_compatibility_file() {
        let root = scratch("refresh");
        let cache = root.join("classmaps");
        let selected = cache.join("1030000");
        std::fs::create_dir_all(&selected).expect("cache dir");
        let classmap = br#"{"main":{}}"#.to_vec();
        let meta = br#"{"status":"verified"}"#.to_vec();
        let expose = br#"{"patches":[]}"#.to_vec();
        let old_overlay = b"{}".to_vec();
        let overlay = br#"{"newHash":"playback-bar"}"#.to_vec();
        let file_ref =
            |file: &str, bytes: &[u8]| serde_json::json!({"file": file, "sha256": digest(bytes)});
        let index = serde_json::json!({
            "expose": file_ref("expose.json", &expose),
            "keys": {"1030000": {
                "classmap": file_ref("classmap.json", &classmap),
                "meta": file_ref("META.json", &meta),
                "cssMapOverlay": file_ref("css-map.json", &overlay)
            }}
        });
        let mut old_index = index.clone();
        *old_index.pointer_mut("/keys/1030000/cssMapOverlay").expect("overlay entry") =
            file_ref("css-map.json", &old_overlay);
        for (path, body) in [
            (cache.join("expose.json"), &expose),
            (selected.join("classmap.json"), &classmap),
            (selected.join("META.json"), &meta),
            (selected.join("css-map.json"), &old_overlay),
        ] {
            std::fs::write(path, body).expect("cached file");
        }
        let (origin, worker) = serve(vec![
            ("200 OK", serde_json::to_vec(&old_index).expect("old index")),
            ("200 OK", serde_json::to_vec(&index).expect("index")),
            ("200 OK", expose),
            ("200 OK", classmap),
            ("200 OK", meta),
            ("200 OK", overlay.clone()),
        ]);
        assert_eq!(
            fetch_classmap_from(&root, "1030000", &origin, false).expect("normal cached apply"),
            "1030000"
        );
        assert_eq!(std::fs::read(selected.join("css-map.json")).expect("old overlay"), old_overlay);
        assert_eq!(
            fetch_classmap_from(&root, "1030000", &origin, true).expect("fresh apply"),
            "1030000"
        );
        assert_eq!(std::fs::read(selected.join("css-map.json")).expect("new overlay"), overlay);
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(
                &std::fs::read(cache.join("index.json")).expect("cached index")
            )
            .expect("index JSON"),
            index
        );
        let requests = worker.join().expect("fixture completed");
        assert!(
            requests.first().expect("normal index request").starts_with("GET /index.json HTTP/1.1")
        );
        for (request, path) in requests.iter().skip(1).zip([
            "index.json",
            "expose.json",
            "1030000/classmap.json",
            "1030000/META.json",
            "1030000/css-map.json",
        ]) {
            assert!(request.starts_with(&format!("GET /{path}?_spicetify_refresh=")), "{request}");
            assert!(request.to_ascii_lowercase().contains("cache-control: no-cache"), "{request}");
        }
        std::fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn no_cache_rejects_bad_downloads_and_retains_the_cached_file() {
        let root = scratch("bad-download");
        let old = b"verified cached file";
        std::fs::write(root.join("css-map.json"), old).expect("old file");
        let (origin, worker) = serve(vec![("200 OK", b"stale CDN response".to_vec())]);
        let download = Download {
            client: crate::http::blocking_client(5).expect("client"),
            origin: &origin,
            cache_bust: Some("test-refresh".to_string()),
        };
        let error = download
            .cache_file(
                None,
                &FileRef { file: "css-map.json".to_string(), sha256: digest(old) },
                &root,
            )
            .expect_err("bad digest");
        assert!(error.to_string().contains("checksum mismatch"), "{error}");
        assert_eq!(std::fs::read(root.join("css-map.json")).expect("retained cache"), old);
        let _ = worker.join().expect("fixture completed");
        std::fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn no_cache_propagates_exposure_refresh_failure() {
        let root = scratch("exposure-failure");
        let index =
            serde_json::json!({"keys": {}, "expose": {"file": "expose.json", "sha256": "unused"}});
        let (origin, worker) = serve(vec![
            ("200 OK", serde_json::to_vec(&index).expect("index")),
            ("503 Service Unavailable", Vec::new()),
        ]);
        let error = fetch_classmap_from(&root, "1030000", &origin, true)
            .expect_err("fresh exposure required");
        assert!(error.to_string().contains("could not refresh the exposure patches"), "{error}");
        let _ = worker.join().expect("fixture completed");
        std::fs::remove_dir_all(root).expect("cleanup");
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
