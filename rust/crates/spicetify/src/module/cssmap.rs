// Rewrites Spotify's hashed class names to the stable semantic names the
// ecosystem targets (`main-actionButtons`, `main-nowPlayingBar-extraControls`,
// …).
//
// This is what makes stdlib's registers, v2-era themes and any CSS written
// against spicetify's vocabulary work at all: without it the client only ever
// renders hashes, every `.main-*` selector misses, and modules have nothing to
// anchor to.
//
// Ported from the Go CLI's preprocess (src/preprocess/preprocess.go). The
// replacement runs as a single Aho-Corasick pass because a sequential pass per
// key would mean thousands of scans over a multi-megabyte bundle.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use aho_corasick::{AhoCorasick, MatchKind};
use regex::Regex;

use crate::error::Result;

// A bare key whose colon is separated by whitespace: the `key:` pattern below
// cannot match those, so they are normalised first.
static BARE_KEY_SPACED: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b[a-zA-Z0-9_]{16,21}[ \t]+:").expect("valid pattern"));

const EMBEDDED_CSS_MAP: &str = include_str!(concat!(env!("OUT_DIR"), "/css-map.json"));

pub(crate) struct CssMap {
    map: BTreeMap<String, String>,
    replacer: AhoCorasick,
    replacements: Vec<String>,
}

impl CssMap {
    /// Loads the global map, then merges the per-version overlay when one ships
    /// beside the classmap. A missing or malformed overlay is non-fatal.
    pub(crate) fn load(config_root: &Path, classmap_key: &str) -> Option<Self> {
        let (raw, source) = match find_css_map(config_root) {
            Some(path) => {
                let raw = std::fs::read_to_string(&path).ok()?;
                let source = path.display().to_string();
                (raw, source)
            }
            None => (EMBEDDED_CSS_MAP.to_string(), "embedded".to_string()),
        };
        let mut map: BTreeMap<String, String> = serde_json::from_str(&raw).ok()?;
        tracing::info!("using css map {source} ({} entries)", map.len());

        if let Some(overlay) = find_overlay(config_root, classmap_key)
            .and_then(|p| std::fs::read_to_string(p).ok())
            .and_then(|raw| serde_json::from_str::<BTreeMap<String, String>>(&raw).ok())
            && !overlay.is_empty()
        {
            tracing::info!(
                "applied css-map overlay for {classmap_key} ({} entries)",
                overlay.len()
            );
            map.extend(overlay);
        }

        // Two patterns per key. The `key:` form wins because it is listed
        // first and is the longer match, mirroring the Go replacer's ordering.
        let mut patterns = Vec::with_capacity(map.len() * 2);
        let mut replacements = Vec::with_capacity(map.len() * 2);
        for (hashed, semantic) in &map {
            patterns.push(format!("{hashed}:"));
            replacements.push(format!("\"{semantic}\":"));
        }
        for (hashed, semantic) in &map {
            patterns.push(hashed.clone());
            replacements.push(semantic.clone());
        }

        let replacer =
            AhoCorasick::builder().match_kind(MatchKind::LeftmostFirst).build(&patterns).ok()?;
        Some(Self { map, replacer, replacements })
    }

    /// JS sources: normalise spaced bare keys, then rewrite every occurrence.
    pub(crate) fn apply_js(&self, content: &str) -> String {
        let normalised = BARE_KEY_SPACED.replace_all(content, |caps: &regex::Captures<'_>| {
            let matched = &caps[0];
            let key = matched.trim_end_matches([' ', '\t', ':']).trim_end();
            match self.map.get(key) {
                Some(semantic) => format!("\"{semantic}\":"),
                None => matched.to_string(),
            }
        });
        self.replacer.replace_all(&normalised, &self.replacements)
    }

    /// CSS sources carry no object keys, so the bare rewrite is enough.
    pub(crate) fn apply_css(&self, content: &str) -> String {
        self.replacer.replace_all(content, &self.replacements)
    }
}

fn search_dirs(config_root: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(explicit) = std::env::var("SPICETIFY_CSS_MAP")
        && !explicit.trim().is_empty()
    {
        dirs.push(PathBuf::from(explicit));
    }
    if let Ok(exe) = std::env::current_exe()
        && let Some(parent) = exe.parent()
    {
        dirs.push(parent.to_path_buf());
    }
    dirs.push(config_root.to_path_buf());
    dirs
}

fn find_css_map(config_root: &Path) -> Option<PathBuf> {
    for dir in search_dirs(config_root) {
        let direct = if dir.is_file() { dir.clone() } else { dir.join("css-map.json") };
        if direct.is_file() {
            return Some(direct);
        }
    }
    None
}

/// The overlay ships beside the classmap for that Spotify build.
fn find_overlay(config_root: &Path, classmap_key: &str) -> Option<PathBuf> {
    for root in super::stage::classmap_roots(config_root) {
        let candidate = root.join(classmap_key).join("css-map.json");
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

/// Rewrites every JS and CSS file under the extracted client in place,
/// **including the staged modules**.
///
/// Modules must be rewritten too. The classmap gives them hashed class names,
/// and this pass renames those same hashes in the client, so skipping modules
/// leaves them pointing at classes that no longer exist: the element renders
/// with no styling at all. Running one pass over everything is what keeps the
/// two maps consistent no matter which names change between Spotify versions.
///
/// Symlinks are never followed: `hooks` and `store` link back into the user's
/// config, and rewriting through them would edit their source files.
pub(crate) fn apply_to_tree(map: &CssMap, root: &Path) -> Result<usize> {
    let mut touched = 0usize;
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let path = entry.path();
            let kind = entry.file_type()?;
            if kind.is_symlink() {
                continue;
            }
            if kind.is_dir() {
                stack.push(path);
                continue;
            }
            let Some(ext) = path.extension().and_then(|e| e.to_str()) else { continue };
            let is_js = ext == "js";
            if !is_js && ext != "css" {
                continue;
            }
            let Ok(content) = std::fs::read_to_string(&path) else { continue };
            let rewritten = if is_js { map.apply_js(&content) } else { map.apply_css(&content) };
            if rewritten != content {
                std::fs::write(&path, rewritten)?;
                touched += 1;
            }
        }
    }
    Ok(touched)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn map_with(pairs: &[(&str, &str)]) -> CssMap {
        let map: BTreeMap<String, String> =
            pairs.iter().map(|(k, v)| ((*k).to_string(), (*v).to_string())).collect();
        let mut patterns = Vec::new();
        let mut replacements = Vec::new();
        for (h, s) in &map {
            patterns.push(format!("{h}:"));
            replacements.push(format!("\"{s}\":"));
        }
        for (h, s) in &map {
            patterns.push(h.clone());
            replacements.push(s.clone());
        }
        let replacer = AhoCorasick::builder()
            .match_kind(MatchKind::LeftmostFirst)
            .build(&patterns)
            .expect("test patterns build");
        CssMap { map, replacer, replacements }
    }

    #[test]
    fn rewrites_a_bare_class_reference() {
        let m = map_with(&[("n8Bz0c0v17whD3KfMdOk", "main-actionButtons")]);
        assert_eq!(
            m.apply_css(".n8Bz0c0v17whD3KfMdOk{color:red}"),
            ".main-actionButtons{color:red}"
        );
    }

    #[test]
    fn quotes_an_object_key_form() {
        let m = map_with(&[("n8Bz0c0v17whD3KfMdOk", "main-actionButtons")]);
        assert_eq!(m.apply_js("{n8Bz0c0v17whD3KfMdOk:1}"), "{\"main-actionButtons\":1}");
    }

    #[test]
    fn handles_a_key_spaced_from_its_colon() {
        let m = map_with(&[("n8Bz0c0v17whD3KfMdOk", "main-actionButtons")]);
        assert_eq!(m.apply_js("{n8Bz0c0v17whD3KfMdOk : 1}"), "{\"main-actionButtons\": 1}");
    }

    #[test]
    fn leaves_unmapped_hashes_alone() {
        let m = map_with(&[("n8Bz0c0v17whD3KfMdOk", "main-actionButtons")]);
        let src = ".someOtherHashedName{}";
        assert_eq!(m.apply_css(src), src);
    }
}
