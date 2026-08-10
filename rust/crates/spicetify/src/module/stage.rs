// Stages installed modules into the extracted client: every module tree is
// copied in, text sources have their MAP.* classmap references rewritten to
// the class names this Spotify build actually uses, and a manifest.json is
// written for the modular loader to boot from.
//
// This mirrors the Go CLI's staging pipeline (src/utils/modules.go and
// classmap_remap.go); the manifest shape is a contract shared with
// src/jsHelper/modularLoader.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::error::Result;

// MAP.a.b.c references, as emitted by the modules' build.
static CLASSMAP_REF: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\bMAP((?:\.[A-Za-z_][A-Za-z0-9_]*)+)").expect("valid pattern"));

const REMAPPED_EXTENSIONS: [&str; 6] = ["js", "mjs", "css", "ts", "tsx", "jsx"];
const SKIPPED_FILES: [&str; 2] = ["metadata.json", "spicetify-module.json"];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct ModuleMetadata {
    pub name: String,
    /// What the module is: extension, theme, snippet, app or lib. The loader
    /// only acts on "theme" (one may be live at a time). Optional because a
    /// module published before `kind` carries `tags` instead, which the
    /// loader still falls back to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    pub version: String,
    #[serde(default)]
    pub authors: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub compat: Vec<String>,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub entries: serde_json::Map<String, serde_json::Value>,
    #[serde(rename = "hasMixins", default)]
    pub has_mixins: bool,
    // A module with no dependencies writes `[]` rather than `{}`; both
    // normalize to an empty map so the manifest shape stays stable.
    #[serde(default, deserialize_with = "dependency_map")]
    pub dependencies: serde_json::Map<String, serde_json::Value>,
}

fn dependency_map<'de, D>(
    deserializer: D,
) -> std::result::Result<serde_json::Map<String, serde_json::Value>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Ok(match serde_json::Value::deserialize(deserializer)? {
        serde_json::Value::Object(map) => map,
        _ => serde_json::Map::new(),
    })
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct StagedModule {
    pub identifier: String,
    #[serde(flatten)]
    pub metadata: ModuleMetadata,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ModulesManifest {
    pub spotify_version: String,
    pub classmap_key: String,
    pub cli_version: String,
    /// Read by the manager module's Updates panel.
    pub updates_blocked: bool,
    pub classmap_fallback: bool,
    pub classmap: serde_json::Value,
    pub modules: Vec<StagedModule>,
}

/// Spotify 1.2.94.583 -> classmap key 1020094: major, minor padded to two
/// digits, patch padded to four. Matches the Go CLI's key derivation.
#[must_use]
pub(crate) fn classmap_key_for_version(version: &str) -> Option<String> {
    let mut parts = version.split('.');
    let major: u32 = parts.next()?.trim().parse().ok()?;
    let minor: u32 = parts.next()?.trim().parse().ok()?;
    let patch: u32 = parts.next()?.trim().parse().ok()?;
    Some(format!("{major}{minor:02}{patch:04}"))
}

/// Search roots for classmaps: an explicit override, then beside the running
/// binary, then the config root (matching the Go CLI's search order).
pub(crate) fn classmap_roots(config_root: &Path) -> Vec<PathBuf> {
    classmap_search_dirs(config_root)
}

fn classmap_search_dirs(config_root: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(explicit) = std::env::var("SPICETIFY_CLASSMAPS_DIR")
        && !explicit.trim().is_empty()
    {
        dirs.push(PathBuf::from(explicit));
    }
    if let Ok(exe) = std::env::current_exe()
        && let Some(parent) = exe.parent()
    {
        dirs.push(parent.join("classmaps"));
    }
    dirs.push(config_root.join("classmaps"));
    dirs
}

/// The classmap to stage against: the exact key when it exists, otherwise the
/// nearest lower key sharing the same major.minor. A Spotify patch release
/// usually re-hashes nothing, so the previous patch's map still applies;
/// crossing a minor is not assumed to be safe.
///
/// Returns the resolved key and whether it is a fallback.
fn resolve_classmap_key(config_root: &Path, key: &str) -> Option<(String, bool)> {
    if find_classmap_file(config_root, key).is_some() {
        return Some((key.to_string(), false));
    }

    let target: u64 = key.parse().ok()?;

    let mut available = Vec::new();
    for root in classmap_search_dirs(config_root) {
        let Ok(entries) = std::fs::read_dir(&root) else { continue };
        for entry in entries.filter_map(std::result::Result::ok) {
            let Some(name) = entry.file_name().to_str().map(String::from) else { continue };
            let Ok(candidate) = name.parse::<u64>() else { continue };
            if find_classmap_file(config_root, &name).is_some() {
                available.push(candidate);
            }
        }
    }

    pick_fallback_key(&available, target).map(|k| (k.to_string(), true))
}

/// The newest key below `target` that shares its major.minor bucket (the key's
/// low four digits are the patch).
pub(crate) fn pick_fallback_key(available: &[u64], target: u64) -> Option<u64> {
    let bucket = target / 10_000;
    available.iter().copied().filter(|k| k / 10_000 == bucket && *k < target).max()
}

/// The preferred classmap file for a key: `classmap.json` when present,
/// otherwise the highest-sorting `classmap-*.json`.
fn find_classmap_file(config_root: &Path, key: &str) -> Option<PathBuf> {
    for root in classmap_search_dirs(config_root) {
        let dir = root.join(key);
        if !dir.is_dir() {
            continue;
        }
        let direct = dir.join("classmap.json");
        if direct.is_file() {
            return Some(direct);
        }
        let mut matches: Vec<PathBuf> = std::fs::read_dir(&dir)
            .ok()?
            .filter_map(std::result::Result::ok)
            .map(|e| e.path())
            .filter(|p| {
                p.file_name().and_then(|n| n.to_str()).is_some_and(|n| {
                    n.starts_with("classmap-")
                        && Path::new(n).extension().is_some_and(|e| e == "json")
                })
            })
            .collect();
        matches.sort();
        if let Some(best) = matches.pop() {
            return Some(best);
        }
    }
    None
}

/// Classmap paths whose leaves are known stale, from a META.json beside the
/// classmap. Resolving one is an error: shipping a stale hash silently is
/// worse than failing loudly.
fn stale_leaves(classmap_path: &Path) -> BTreeSet<String> {
    let Some(dir) = classmap_path.parent() else {
        return BTreeSet::new();
    };
    let Ok(raw) = std::fs::read_to_string(dir.join("META.json")) else {
        return BTreeSet::new();
    };
    serde_json::from_str::<serde_json::Value>(&raw)
        .ok()
        .and_then(|v| v.get("stale_leaves").and_then(|s| s.as_array()).cloned())
        .map(|items| items.iter().filter_map(|i| i.as_str().map(String::from)).collect())
        .unwrap_or_default()
}

fn resolve_leaf(classmap: &serde_json::Value, dotted: &str) -> Option<String> {
    let mut cur = classmap;
    for part in dotted.split('.') {
        cur = cur.get(part)?;
    }
    cur.as_str().map(String::from)
}

/// Rewrites MAP.* references to quoted class-name literals. Any reference that
/// does not resolve, or resolves to a stale leaf, fails the whole file.
fn remap_source(
    src: &str,
    classmap: &serde_json::Value,
    stale: &BTreeSet<String>,
) -> Result<String> {
    let mut unresolved = BTreeSet::new();
    let mut hit_stale = BTreeSet::new();

    let out = CLASSMAP_REF.replace_all(src, |caps: &regex::Captures<'_>| {
        let dotted = caps[1].trim_start_matches('.').to_string();
        if stale.contains(&dotted) {
            let _ = hit_stale.insert(dotted);
            return caps[0].to_string();
        }
        if let Some(leaf) = resolve_leaf(classmap, &dotted) {
            serde_json::to_string(&leaf).unwrap_or_else(|_| caps[0].to_string())
        } else {
            let _ = unresolved.insert(dotted);
            caps[0].to_string()
        }
    });

    if unresolved.is_empty() && hit_stale.is_empty() {
        return Ok(out.into_owned());
    }
    let mut parts = Vec::new();
    if !unresolved.is_empty() {
        parts.push(format!(
            "unresolved: {}",
            unresolved.iter().cloned().collect::<Vec<_>>().join(", ")
        ));
    }
    if !hit_stale.is_empty() {
        parts.push(format!("stale: {}", hit_stale.iter().cloned().collect::<Vec<_>>().join(", ")));
    }
    Err(anyhow::anyhow!("classmap references failed ({})", parts.join("; ")))
}

fn stage_tree(
    src_root: &Path,
    out_dir: &Path,
    classmap: &serde_json::Value,
    stale: &BTreeSet<String>,
) -> Result<()> {
    for entry in std::fs::read_dir(src_root)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name();
        let dest = out_dir.join(&name);

        if entry.file_type()?.is_dir() {
            std::fs::create_dir_all(&dest)?;
            stage_tree(&path, &dest, classmap, stale)?;
            continue;
        }
        if name.to_str().is_some_and(|n| SKIPPED_FILES.contains(&n)) {
            continue;
        }

        std::fs::create_dir_all(out_dir)?;
        let remapped = path
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| REMAPPED_EXTENSIONS.contains(&e.to_lowercase().as_str()));
        if remapped {
            let raw = std::fs::read_to_string(&path)?;
            std::fs::write(&dest, remap_source(&raw, classmap, stale)?)?;
        } else {
            std::fs::copy(&path, &dest).map(|_| ())?;
        }
    }
    Ok(())
}

/// Stages every module under `modules_root` into `<xpui>/modules` and writes
/// the loader's manifest. Returns the number of modules staged; a module whose
/// classmap references fail is skipped with a warning rather than failing the
/// whole apply.
pub(crate) fn stage_modules(
    config_root: &Path,
    modules_root: &Path,
    xpui: &Path,
    spotify_version: &str,
    cli_version: &str,
    updates_blocked: bool,
) -> Result<usize> {
    if !modules_root.is_dir() {
        tracing::info!("no modules directory at {}: nothing to stage", modules_root.display());
        return Ok(0);
    }

    let wanted = classmap_key_for_version(spotify_version).ok_or_else(|| {
        anyhow::anyhow!("cannot derive a classmap key from Spotify version {spotify_version}")
    })?;
    let (key, classmap_fallback) = resolve_classmap_key(config_root, &wanted).ok_or_else(|| {
        anyhow::anyhow!(
            "no classmap found for key {wanted} (set SPICETIFY_CLASSMAPS_DIR or install one)"
        )
    })?;
    if classmap_fallback {
        tracing::warn!(
            "no classmap for {wanted}; falling back to {key}. Modules may misbehave if this \
             Spotify build re-hashed class names"
        );
    }
    let classmap_path = find_classmap_file(config_root, &key)
        .ok_or_else(|| anyhow::anyhow!("classmap for key {key} disappeared while resolving it"))?;
    let classmap: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&classmap_path)?)?;
    let stale = stale_leaves(&classmap_path);
    tracing::info!(
        "using classmap {} ({} stale leaf/leaves)",
        classmap_path.display(),
        stale.len()
    );

    let out_root = xpui.join("modules");
    if let Err(e) = std::fs::remove_dir_all(&out_root)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(error = %e, "failed to clear staged modules");
    }
    std::fs::create_dir_all(&out_root)?;

    let mut staged = Vec::new();
    let mut entries: Vec<PathBuf> = std::fs::read_dir(modules_root)?
        .filter_map(std::result::Result::ok)
        .map(|e| e.path())
        .collect();
    entries.sort();

    for dir in entries {
        if !dir.is_dir() {
            continue;
        }
        let Some(identifier) = dir.file_name().and_then(|n| n.to_str()).map(String::from) else {
            continue;
        };
        let metadata_path = dir.join("metadata.json");
        if !metadata_path.is_file() {
            continue;
        }
        let metadata: ModuleMetadata = match std::fs::read_to_string(&metadata_path)
            .map_err(anyhow::Error::from)
            .and_then(|raw| serde_json::from_str(&raw).map_err(anyhow::Error::from))
        {
            Ok(m) => m,
            Err(e) => {
                tracing::warn!("skipping module {identifier}: unreadable metadata ({e})");
                continue;
            }
        };

        let out_dir = out_root.join(&identifier);
        if let Err(e) = stage_tree(&dir, &out_dir, &classmap, &stale) {
            if let Err(e) = std::fs::remove_dir_all(&out_dir)
                && e.kind() != std::io::ErrorKind::NotFound
            {
                tracing::warn!(error = %e, "failed to clean up partially staged module");
            }
            tracing::warn!("skipping module {identifier}: {e}");
            continue;
        }
        staged.push(StagedModule { identifier, metadata });
    }

    if staged.is_empty() {
        tracing::warn!("no modules staged");
        return Ok(0);
    }

    let manifest = ModulesManifest {
        spotify_version: spotify_version.to_string(),
        classmap_key: key,
        cli_version: cli_version.to_string(),
        updates_blocked,
        classmap_fallback,
        classmap,
        modules: staged,
    };
    std::fs::write(out_root.join("manifest.json"), serde_json::to_string_pretty(&manifest)?)?;
    Ok(manifest.modules.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn classmap() -> serde_json::Value {
        serde_json::json!({ "main": { "navbar": { "link": "abc123" } } })
    }

    #[test]
    fn falls_back_to_the_nearest_lower_patch() {
        let available = [1_020_045, 1_020_092, 1_020_094];
        assert_eq!(
            pick_fallback_key(&available, 1_020_095),
            Some(1_020_094),
            "the newest lower key in the same major.minor wins"
        );
    }

    #[test]
    fn never_falls_back_across_a_minor_or_upwards() {
        let available = [1_020_094];
        assert_eq!(
            pick_fallback_key(&available, 1_030_001),
            None,
            "a minor bump must not reuse the previous minor's map"
        );
        assert_eq!(
            pick_fallback_key(&available, 1_020_001),
            None,
            "a higher key must never satisfy a lower one"
        );
    }

    #[test]
    fn derives_the_classmap_key_like_the_go_cli() {
        assert_eq!(classmap_key_for_version("1.2.94.583").as_deref(), Some("1020094"));
        assert_eq!(classmap_key_for_version("1.2.38.720").as_deref(), Some("1020038"));
        assert_eq!(classmap_key_for_version("nonsense"), None);
    }

    #[test]
    fn rewrites_references_to_quoted_leaves() {
        let out = remap_source("const a = MAP.main.navbar.link;", &classmap(), &BTreeSet::new())
            .expect("remap succeeds");
        assert_eq!(out, r#"const a = "abc123";"#);
    }

    #[test]
    fn unresolved_reference_fails_the_file() {
        let err = remap_source("MAP.main.missing", &classmap(), &BTreeSet::new())
            .expect_err("remap fails");
        assert!(err.to_string().contains("unresolved"), "{err}");
    }

    #[test]
    fn stale_leaf_fails_rather_than_shipping_a_bad_hash() {
        let stale: BTreeSet<String> = ["main.navbar.link".to_string()].into_iter().collect();
        let err =
            remap_source("MAP.main.navbar.link", &classmap(), &stale).expect_err("remap fails");
        assert!(err.to_string().contains("stale"), "{err}");
    }

    #[test]
    fn leaves_unrelated_identifiers_alone() {
        let src = "const MAPPED = 1; MAP.main.navbar.link;";
        let out = remap_source(src, &classmap(), &BTreeSet::new()).expect("remap succeeds");
        assert!(out.contains("const MAPPED = 1;"), "{out}");
    }
}
