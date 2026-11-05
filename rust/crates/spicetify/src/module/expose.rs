// Apply-time source patches that expose Spotify's internals on the Spicetify
// global. The extracted client bundle is minified and shipped without any
// stable API surface, so the wrapper (src/jsHelper/spicetifyWrapper) can only
// find Platform, URI, Snackbar and friends because these rewrites hang them
// off `Spicetify.*` first.
//
// The regex patches are data, not code: `expose.json`, published by
// spicetify/classmaps and fetched beside the classmaps (remote.rs), so a
// Spotify update that reshapes the minified code is answered with a data
// commit rather than a CLI release. The copy at the cli repo root rides in
// the binary as the offline baseline. Every patch targets the client bundle
// prepared by apply.rs: xpui-modules.js extracted from the v8 snapshot on
// older clients, or the xpui.js shipped directly in Spotify 1.3 and newer.
// Two rewrites stay in Rust because they read identifiers out of the
// surrounding code rather than matching a fixed shape: the context-menu
// provider and the URI class scan. A third, the now-playing menu provider,
// runs over the lazy chunks beside the bundle, which the patch set never sees.
//
// The `expose_hits_on_real_bundles` test below measures a patch set against
// real extracted bundles; run it whenever a Spotify update lands before
// deciding a pattern is dead or re-deriving one.

use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::{Captures, Regex};
use serde::Deserialize;

const EMBEDDED_PATCHES: &str = include_str!(concat!(env!("OUT_DIR"), "/expose.json"));

/// The one file name the published set may have: the fetch refuses any other
/// (so an index entry cannot clobber a sibling such as index.json) and the
/// loader looks for exactly this beside the cached classmaps.
pub(crate) const EXPOSE_FILE: &str = "expose.json";

/// How a patch that matched nothing is reported.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
enum OnMiss {
    /// A miss means a Spotify update moved code and the surface is gone: warn.
    #[default]
    Warn,
    /// A miss is expected on some supported builds (the target left the
    /// client, or the wrapper rebuilds the surface at runtime).
    Quiet,
}

// A value this build does not know is read as `warn`, so a data set that
// grows a third mode still loads on older CLIs instead of falling to embedded.
impl<'de> Deserialize<'de> for OnMiss {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let raw = String::deserialize(deserializer)?;
        Ok(match raw.as_str() {
            "warn" => Self::Warn,
            "quiet" => Self::Quiet,
            other => {
                tracing::warn!("unknown onMiss value {other:?}: treating it as warn");
                Self::Warn
            }
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PatchSpec {
    name: String,
    pattern: String,
    /// A capture-group template: `${0}` is the whole match, `${N}` group N,
    /// `$$` a literal dollar.
    replace: String,
    #[serde(default)]
    once: bool,
    #[serde(default)]
    on_miss: OnMiss,
}

#[derive(Debug, Deserialize)]
struct PatchFile {
    #[serde(default)]
    patches: Vec<PatchSpec>,
}

/// A loaded patch set: every pattern compiled once. A patch whose pattern does
/// not compile, or whose template names a group the pattern lacks, is dropped
/// here with a warning and its name kept, so apply reports it beside the
/// patches that matched nothing.
pub(crate) struct PatchSet {
    source: String,
    patches: Vec<(PatchSpec, Regex)>,
    dropped: Vec<String>,
}

impl PatchSet {
    fn parse(raw: &str, source: String) -> Result<Self, serde_json::Error> {
        let file: PatchFile = serde_json::from_str(raw)?;
        let mut patches = Vec::with_capacity(file.patches.len());
        let mut dropped = Vec::new();
        for spec in file.patches {
            let re = match Regex::new(&spec.pattern) {
                Ok(re) => re,
                Err(e) => {
                    tracing::warn!(error = %e, "patch {} has an invalid pattern: skipped", spec.name);
                    dropped.push(spec.name);
                    continue;
                }
            };
            if let Some(name) = missing_template_group(&spec.replace, &re) {
                tracing::warn!("patch {} references missing group {name}: skipped", spec.name);
                dropped.push(spec.name);
                continue;
            }
            patches.push((spec, re));
        }
        Ok(Self { source, patches, dropped })
    }

    fn embedded() -> Self {
        Self::parse(EMBEDDED_PATCHES, "embedded".to_string()).unwrap_or_else(|e| {
            tracing::warn!(error = %e, "the embedded exposure patch set is malformed");
            Self { source: "embedded".to_string(), patches: Vec::new(), dropped: Vec::new() }
        })
    }

    fn is_usable(&self) -> bool {
        !self.patches.is_empty()
    }

    fn len(&self) -> usize {
        self.patches.len()
    }

    #[cfg(test)]
    fn names(&self) -> impl Iterator<Item = &str> {
        self.patches.iter().map(|(spec, _)| spec.name.as_str())
    }
}

/// The first capture reference in `template` naming a group the pattern does not
/// have. `Captures::expand` would substitute an empty string there, which is
/// how a typo in a published template would inject broken code into the
/// client; refusing the patch at load turns that into a diagnostic. `$$` is
/// the literal-dollar escape and is skipped.
fn missing_template_group<'a>(template: &'a str, re: &Regex) -> Option<&'a str> {
    static GROUP_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"\$(?:\$|\{([^}]*)\}|([0-9A-Za-z_]+))")
            .expect("valid replacement group pattern")
    });
    GROUP_RE.captures_iter(template).find_map(|caps| {
        let name = caps.get(1).or_else(|| caps.get(2))?.as_str();
        let exists = match name.parse::<usize>() {
            Ok(group) => group < re.captures_len(),
            Err(_) => re.capture_names().flatten().any(|candidate| candidate == name),
        };
        (!exists).then_some(name)
    })
}

/// Loads the patch set for this apply. Candidates, first usable wins: an
/// explicit `SPICETIFY_EXPOSE_PATCHES` file, then `expose.json` in each
/// classmap root in the order staging searches them (`SPICETIFY_CLASSMAPS_DIR`,
/// beside the executable, the fetched cache in the config root), then the
/// embedded copy. A candidate that is missing, malformed, or has no usable
/// patch falls through to the next.
pub(crate) fn load_patches(config_root: &Path) -> PatchSet {
    let mut candidates = Vec::new();
    if let Ok(explicit) = std::env::var("SPICETIFY_EXPOSE_PATCHES")
        && !explicit.trim().is_empty()
    {
        candidates.push(PathBuf::from(explicit));
    }
    candidates.extend(
        super::stage::classmap_search_dirs(config_root).into_iter().map(|d| d.join(EXPOSE_FILE)),
    );
    load_from(&candidates, &config_root.join("classmaps").join(EXPOSE_FILE))
}

fn load_from(candidates: &[PathBuf], published: &Path) -> PatchSet {
    for path in candidates {
        let Ok(raw) = std::fs::read_to_string(path) else { continue };
        match PatchSet::parse(&raw, path.display().to_string()) {
            // A set that compiles to nothing would win and expose nothing at
            // all; the next candidate is the better answer.
            Ok(set) if !set.is_usable() => {
                tracing::warn!(path = %path.display(), "exposure patch set has no usable patch: trying the next source");
            }
            Ok(set) => {
                if path != published {
                    tracing::warn!(path = %path.display(), "using a local exposure patch set instead of the published one");
                }
                tracing::info!("using exposure patches {} ({} patches)", set.source, set.len());
                return set;
            }
            Err(e) => {
                tracing::warn!(error = %e, path = %path.display(), "exposure patch set is malformed: trying the next source");
            }
        }
    }
    let set = PatchSet::embedded();
    if set.is_usable() {
        tracing::info!("using exposure patches {} ({} patches)", set.source, set.len());
    } else {
        tracing::warn!("no exposure patches available: Spicetify.* internals will not be exposed");
    }
    set
}

/// Applies one patch. Returns the rewritten bundle, or `None` when the patch
/// matched nothing, so a total miss costs no copy of the 8 MB bundle and the
/// caller can log the patches that stopped matching after a Spotify update.
fn apply(input: &str, spec: &PatchSpec, re: &Regex) -> Option<String> {
    let mut matches = re.captures_iter(input);
    let first = matches.next()?;
    let mut out = String::with_capacity(input.len() + spec.replace.len());
    let mut last = 0;
    for caps in std::iter::once(first).chain(matches) {
        let Some(m) = caps.get(0) else { continue };
        out.push_str(&input[last..m.start()]);
        caps.expand(&spec.replace, &mut out);
        last = m.end();
        if spec.once {
            break;
        }
    }
    out.push_str(&input[last..]);
    Some(out)
}

fn group(caps: &Captures<'_>, i: usize) -> String {
    caps.get(i).map_or_else(String::new, |m| m.as_str().to_string())
}

/// Rewrites the context-menu provider so `Spicetify.ContextMenuV2` can inject
/// items. The identifiers are read out of the surrounding minified code, which
/// is why this is not a plain patch-list entry.
fn patch_context_menu(input: String) -> (String, bool) {
    static CROP_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r#".*(?:value:"contextmenu"|"[^"]*":"context-menu")"#)
            .expect("valid context menu crop pattern")
    });
    static REACT_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"([a-zA-Z_\$][\w\$]*)\.useRef").expect("valid React reference pattern")
    });
    static MENU_PROPERTIES_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"([a-zA-Z_\$][\w\$]*)=[\w_$]+\.menu[^}]*,([a-zA-Z_\$][\w\$]*)=[\w_$]+\.trigger[^}]*,([a-zA-Z_\$][\w\$]*)=[\w_$]+\.triggerRef")
            .expect("valid menu properties pattern")
    });
    static MENU_DESTRUCTURING_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"\(\{[^}]*menu:([a-zA-Z_\$][\w\$]*),[^}]*trigger:([a-zA-Z_\$][\w\$]*),[^}]*triggerRef:([a-zA-Z_\$][\w\$]*)")
            .expect("valid menu destructuring pattern")
    });
    static PROVIDER_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r#"\(0,([\w_$]+)\.jsx\)\((?:[\w_$]+\.[\w_$]+,\{value:"contextmenu"[^}]+\}\)\}\)|"[\w-]+",\{[^}]+:"context-menu"[^}]+\}\))"#)
            .expect("valid context menu provider pattern")
    });
    let Some(cropped) = CROP_RE.find(&input).map(|m| m.as_str()) else {
        return (input, false);
    };

    let last = |re: &Regex, n: usize| -> Option<Vec<String>> {
        let caps = re.captures_iter(cropped).last()?;
        Some((0..=n).map(|i| group(&caps, i)).collect())
    };

    let pick = |g: &[String], i: usize| g.get(i).cloned().unwrap_or_default();

    let Some(react) = last(&REACT_RE, 1).map(|g| pick(&g, 1)) else {
        return (input, false);
    };

    let (menu, trigger, target) =
        last(&MENU_PROPERTIES_RE, 3).or_else(|| last(&MENU_DESTRUCTURING_RE, 3)).map_or_else(
            || ("e.menu".to_string(), "e.trigger".to_string(), "e.triggerRef".to_string()),
            |g| (pick(&g, 1), pick(&g, 2), pick(&g, 3)),
        );

    let mut hit = false;
    let out = PROVIDER_RE
        .replace_all(&input, |caps: &Captures<'_>| {
            hit = true;
            format!(
                "(0,{}.jsx)((Spicetify.ContextMenuV2._context||(Spicetify.ContextMenuV2._context={react}.createContext(null))).Provider,{{value:{{props:{menu}?.props,trigger:{trigger},target:{target}}},children:{}}})",
                group(caps, 1),
                group(caps, 0)
            )
        })
        .into_owned();
    (out, hit)
}

/// Exposes `Spicetify.URI` by finding the URI class body (the one carrying
/// `hasBase62Id`) and scanning its balanced braces. A regex over the class
/// prototype used to do this; it stopped matching before 1.2.80, while this
/// scan holds on every supported build (1.2.84 and 1.2.96 measured).
fn patch_uri_fallback(input: String) -> (String, bool) {
    static URI_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"(?:class ([\w$_]+)\{constructor|([\w$_]+)=function\(\)\{function ?[\w$_]+)\([\w$.,={}]+\)\{[\w !?:=.,>&(){}\[\];]*this\.hasBase62Id")
            .expect("valid URI class pattern")
    });
    if input.contains("Spicetify.URI") {
        return (input, false);
    }
    let Some(caps) = URI_RE.captures(&input) else {
        return (input, false);
    };

    let is_class = caps.get(1).is_some();
    let name = if is_class { group(&caps, 1) } else { group(&caps, 2) };
    let start = caps.get(0).map_or(0, |m| m.start());

    // Scan from the class/function body's opening brace to its match.
    let bytes = input.as_bytes();
    let Some(open) = input[start..].find('{').map(|i| start + i) else {
        return (input, false);
    };
    let mut depth = 0i32;
    let mut end = None;
    for (i, b) in bytes.iter().enumerate().skip(open) {
        match b {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    end = Some(i + 1);
                    break;
                }
            }
            _ => {}
        }
    }
    let Some(end) = end else { return (input, false) };
    let body = &input[start..end];
    let replacement = if is_class {
        format!("{body};Spicetify.URI={name};")
    } else {
        format!("{body}();Spicetify.URI={name};")
    };
    (input.replacen(body, &replacement, 1), true)
}

/// Wraps Spotify's now-playing menus in the wrapper's context provider, so
/// `Spicetify.ContextMenuV2` items receive the track they were opened on. The
/// menu trigger around these menus only carries `{canToggleCanvas}`, so the
/// provider value from `patch_context_menu` has no URI and items never show.
/// Returns `None` when nothing matched.
///
/// Measured on 1.3.3, 1.3.4, 1.3.6 and 1.3.7: four call sites, all in lazy
/// chunks (one in a numbered chunk, three in `dwp-panel-section.js`), none in
/// the client bundle.
fn patch_now_playing_menu(input: &str) -> Option<String> {
    static NOW_PLAYING_RE: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"\(0,([\w$]+)\.jsx\)\([\w$]+\.[\w$]+,\{([^{}]*\bcanToggleCanvas:[^{}]*)\}\)")
            .expect("valid now-playing menu pattern")
    });
    let mut hit = false;
    let out = NOW_PLAYING_RE.replace_all(input, |caps: &Captures<'_>| {
        let properties = format!(",{}", group(caps, 2));
        if !properties.contains(",context:") || !properties.contains(",item:") {
            return group(caps, 0);
        }
        hit = true;
        format!(
            "(0,{}.jsx)(Spicetify.ContextMenuV2._Provider,{{children:{}}})",
            group(caps, 1),
            group(caps, 0)
        )
    });
    hit.then(|| out.into_owned())
}

/// Applies the chunk rewrites to every script beside the client bundle in
/// `root`, and returns how many chunks changed. Spotify ships its lazy chunks
/// flat in the archive root.
pub(crate) fn expose_chunks(root: &Path, bundle: &Path) -> std::io::Result<usize> {
    let mut touched = 0;
    for entry in std::fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if path == bundle
            || !entry.file_type()?.is_file()
            || path.extension().is_none_or(|ext| ext != "js")
        {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(&path) else { continue };
        if let Some(patched) = patch_now_playing_menu(&content) {
            std::fs::write(&path, patched)?;
            touched += 1;
        }
    }
    Ok(touched)
}

/// Applies every exposure patch to the extracted client bundle, logging any
/// that stopped matching (the usual symptom of a Spotify update moving code).
/// A miss is only reported when it is actionable: quiet patches never warn.
#[must_use]
pub(crate) fn expose_apis(input: String, patches: &PatchSet) -> String {
    let (mut out, _) = patch_context_menu(input);
    // A patch the loader refused is as absent as one that matched nothing,
    // and it is the publish-side gate's blind spot: name it here.
    let mut missed: Vec<&str> = patches.dropped.iter().map(String::as_str).collect();

    for (spec, re) in &patches.patches {
        match apply(&out, spec, re) {
            Some(next) => out = next,
            None => {
                if spec.on_miss == OnMiss::Warn {
                    missed.push(spec.name.as_str());
                }
            }
        }
    }

    let (out, uri_hit) = patch_uri_fallback(out);
    if !uri_hit {
        missed.push("Spicetify.URI");
    }

    if !missed.is_empty() {
        tracing::warn!("api exposure patches that did not match: {}", missed.join(", "));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn embedded() -> PatchSet {
        PatchSet::embedded()
    }

    fn set(json: &str) -> PatchSet {
        PatchSet::parse(json, "test".to_string()).expect("test json parses")
    }

    #[test]
    fn the_embedded_set_parses_and_every_pattern_compiles() {
        let file: PatchFile = serde_json::from_str(EMBEDDED_PATCHES).expect("embedded json parses");
        assert!(!file.patches.is_empty(), "the embedded set must not be empty");
        for spec in &file.patches {
            assert!(Regex::new(&spec.pattern).is_ok(), "invalid pattern: {}", spec.name);
        }
        let loaded = embedded();
        assert_eq!(loaded.len(), file.patches.len(), "no pattern may be dropped at load");
        assert!(loaded.dropped.is_empty(), "{:?}", loaded.dropped);
    }

    #[test]
    fn exposes_the_platform_object() {
        let src = "registerFactory(a,b){return c}{version:x,container:y}";
        let out = expose_apis(src.to_string(), &embedded());
        assert!(out.contains("Spicetify._platform={version:"), "{out}");
    }

    #[test]
    fn exposes_uri_by_scanning_the_class_body() {
        let src = "class n{constructor(e){this.hasBase62Id=!0}}";
        let out = expose_apis(src.to_string(), &embedded());
        assert!(out.contains("Spicetify.URI=n;"), "{out}");
    }

    #[test]
    fn exposes_tippy_defaults() {
        let out = expose_apis("q.setDefaultProps=function(){}".to_string(), &embedded());
        assert!(out.contains("Spicetify.Tippy=q;"), "{out}");
    }

    #[test]
    fn wraps_now_playing_menus_in_the_context_provider() {
        let src = "a=(0,r.jsx)(l.W,{context:t.context,item:t.item,canToggleCanvas:e}),b=(0,p.jsx)(s6.W,{context:N,item:T,canToggleCanvas:!0})";
        assert_eq!(
            patch_now_playing_menu(src).as_deref(),
            Some(
                "a=(0,r.jsx)(Spicetify.ContextMenuV2._Provider,{children:(0,r.jsx)(l.W,{context:t.context,item:t.item,canToggleCanvas:e})}),b=(0,p.jsx)(Spicetify.ContextMenuV2._Provider,{children:(0,p.jsx)(s6.W,{context:N,item:T,canToggleCanvas:!0})})"
            )
        );
    }

    #[test]
    fn leaves_canvas_toggles_without_a_track_alone() {
        // The menu trigger passes only the toggle: no item to provide.
        assert_eq!(
            patch_now_playing_menu("(0,r.jsx)(u,{canToggleCanvas:e.canToggleCanvas??!1})"),
            None
        );
        assert_eq!(patch_now_playing_menu("(0,r.jsx)(l.W,{item:t,canToggleCanvas:e})"), None);
    }

    #[test]
    fn rewrites_chunks_but_not_the_bundle_or_other_files() {
        let root =
            std::env::temp_dir().join(format!("spicetify-expose-chunks-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("nested")).expect("temporary xpui directory");
        let call = "(0,r.jsx)(l.W,{context:t.context,item:t.item,canToggleCanvas:e})";
        for name in ["xpui.js", "4276.js", "styles.css", "nested/1.js", "plain.js"] {
            let body = if name == "plain.js" { "stockChunk();" } else { call };
            std::fs::write(root.join(name), body).expect("write fixture");
        }

        let touched = expose_chunks(&root, &root.join("xpui.js")).expect("chunks patch");
        assert_eq!(touched, 1);
        let read = |name: &str| std::fs::read_to_string(root.join(name)).expect("read fixture");
        assert!(read("4276.js").starts_with("(0,r.jsx)(Spicetify.ContextMenuV2._Provider,"));
        for name in ["xpui.js", "styles.css", "nested/1.js"] {
            assert_eq!(read(name), call, "{name} is left alone");
        }
        assert_eq!(read("plain.js"), "stockChunk();");

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn leaves_unrelated_source_untouched() {
        let src = "const a = 1; function b(){ return 2; }";
        assert_eq!(expose_apis(src.to_string(), &embedded()), src);
    }

    #[test]
    fn exposes_the_redux_store_from_the_iife_shape() {
        // 1.2.9x: the store is created inside an IIFE invoked with the
        // session/features/seoExperiment object as its first argument.
        let src = "return(0,a.y$)((0,a.HY)({playback:p,session:s}),e,m((0,a.Tw)(...n)))}({session:k,features:S,seoExperiment:w},{platform:g,history:h})";
        let out = expose_apis(src.to_string(), &embedded());
        assert!(out.contains("return Spicetify.Platform.ReduxStore=(0,a.y$)("), "{out}");
    }

    #[test]
    fn exposes_the_image_snackbar_from_the_hook_shape() {
        // 1.2.9x: the enqueue arrow is returned through useCallback instead
        // of being assigned.
        let src = "function d(){let{enqueueCustomSnackbar:e}=(0,c.i)();return(0,n.useCallback)(({message:t,imageSrc:i})=>{e(t)},[e])}";
        let out = expose_apis(src.to_string(), &embedded());
        assert!(
            out.contains("return Spicetify.Snackbar.enqueueImageSnackbar=(0,n.useCallback)("),
            "{out}"
        );
    }

    #[test]
    fn templates_expand_capture_groups_and_once_stops_after_the_first_match() {
        let every =
            set(r#"{"patches":[{"name":"t","pattern":"(a)(b)","replace":"<${2}${1}${0}>"}]}"#);
        assert_eq!(expose_apis("ab ab".to_string(), &every), "<baab> <baab>");
        let once =
            set(r#"{"patches":[{"name":"t","pattern":"(a)(b)","replace":"<${1}>","once":true}]}"#);
        assert_eq!(expose_apis("ab ab".to_string(), &once), "<a> ab");
        let literal = set(r#"{"patches":[{"name":"t","pattern":"a","replace":"$$${0}"}]}"#);
        assert_eq!(expose_apis("a".to_string(), &literal), "$a");
    }

    #[test]
    fn unknown_fields_and_values_are_tolerated() {
        let s = set(
            r#"{"version":9,"future":true,"patches":[{"name":"t","pattern":"x","replace":"y","note":"n","extra":1,"onMiss":"later"}]}"#,
        );
        assert_eq!(s.len(), 1);
        assert_eq!(s.patches[0].0.on_miss, OnMiss::Warn);
        assert!(!s.patches[0].0.once);
    }

    #[test]
    fn an_invalid_pattern_is_dropped_and_reported_as_a_miss() {
        let s = set(
            r#"{"patches":[{"name":"bad","pattern":"(","replace":""},{"name":"ok","pattern":"x","replace":"y"}]}"#,
        );
        assert_eq!(s.names().collect::<Vec<_>>(), vec!["ok"]);
        assert_eq!(s.dropped, vec!["bad"]);
        assert_eq!(expose_apis("x".to_string(), &s), "y");
    }

    #[test]
    fn a_template_naming_a_missing_group_is_dropped() {
        let s = set(
            r#"{"patches":[{"name":"typo","pattern":"(x)","replace":"${2}"},{"name":"bare","pattern":"(x)","replace":"$3"},{"name":"ok","pattern":"(x)","replace":"$$${1}"}]}"#,
        );
        assert_eq!(s.names().collect::<Vec<_>>(), vec!["ok"]);
        assert_eq!(s.dropped, vec!["typo", "bare"]);
        let re = Regex::new("(x)").unwrap();
        assert_eq!(missing_template_group("${0}${1}", &re), None);
        assert_eq!(missing_template_group("$$2", &re), None);
        assert_eq!(missing_template_group("${2}", &re), Some("2"));
        assert_eq!(missing_template_group("a$9b", &re), Some("9b"));
    }

    #[test]
    fn template_validation_uses_the_same_reference_names_as_expansion() {
        for template in
            ["$1abc", "$1_", "${missing}", "${}", "$999999999999999999999999999999999999"]
        {
            let raw = serde_json::json!({"patches":[{"name":"bad", "pattern":"(x)", "replace":template}]}).to_string();
            let s = set(&raw);
            assert_eq!(s.len(), 0, "unknown expansion reference accepted: {template}");
        }
        let s = set(
            r#"{"patches":[{"name":"named","pattern":"(?P<word>x)","replace":"${word}-$word-${1}abc-$$1abc"}]}"#,
        );
        assert_eq!(expose_apis("x".to_string(), &s), "x-x-xabc-$1abc");
    }

    #[test]
    fn template_references_preserve_escaping_and_order() {
        let re = Regex::new("(x)").unwrap();
        for (template, expected) in [
            ("$0 ${1}", None),
            ("$$2", None),
            ("$$$2", Some("2")),
            ("$$$$2", None),
            ("$1 ${2} $9", Some("2")),
            ("$9 $2", Some("9")),
            ("${2", None),
            ("${2x}", Some("2x")),
            ("${name}", Some("name")),
            ("${${2}", Some("${2")),
            ("é💚${2}", Some("2")),
            ("$02", Some("02")),
            ("${+1}", None),
            (
                "$999999999999999999999999999999999999 $2",
                Some("999999999999999999999999999999999999"),
            ),
        ] {
            assert_eq!(missing_template_group(template, &re), expected, "{template:?}");
        }
    }

    #[test]
    fn candidates_are_tried_in_order_and_unusable_ones_fall_through() {
        let root = std::env::temp_dir().join(format!("spicetify-expose-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("scratch");
        let good = |name: &str| {
            format!(r#"{{"patches":[{{"name":"{name}","pattern":"x","replace":"y"}}]}}"#)
        };
        let published = root.join("published.json");
        let local = root.join("local.json");
        let explicit = root.join("explicit.json");
        let missing = root.join("missing.json");
        let load = |candidates: &[&Path]| {
            load_from(&candidates.iter().map(|p| p.to_path_buf()).collect::<Vec<_>>(), &published)
        };

        // Nothing readable: embedded.
        assert_eq!(load(&[&missing, &published]).source, "embedded");
        // Malformed falls through.
        std::fs::write(&published, "{not json").expect("write");
        assert_eq!(load(&[&published]).source, "embedded");
        // A set whose only pattern cannot compile is not usable either.
        std::fs::write(&published, r#"{"patches":[{"name":"bad","pattern":"(","replace":""}]}"#)
            .expect("write");
        assert_eq!(load(&[&published]).source, "embedded");
        // A declared-empty set does not win over embedded.
        std::fs::write(&published, r#"{"patches":[]}"#).expect("write");
        assert_eq!(load(&[&published]).source, "embedded");
        // A usable published set wins over embedded.
        std::fs::write(&published, good("published")).expect("write");
        assert_eq!(load(&[&published]).names().collect::<Vec<_>>(), vec!["published"]);
        // Earlier candidates win; a missing one is skipped, not fatal.
        std::fs::write(&local, good("local")).expect("write");
        std::fs::write(&explicit, good("explicit")).expect("write");
        assert_eq!(
            load(&[&missing, &local, &published]).names().collect::<Vec<_>>(),
            vec!["local"]
        );
        assert_eq!(
            load(&[&explicit, &local, &published]).names().collect::<Vec<_>>(),
            vec!["explicit"]
        );

        let _ = std::fs::remove_dir_all(root);
    }

    /// Measures every patch against real extracted bundles. Ignored by
    /// default; run it with the bundles to compare:
    ///
    ///   SPICETIFY_EXPOSE_BUNDLES=a.js:b.js cargo test -p spicetify expose_hits_on_real_bundles -- --ignored --nocapture
    ///
    /// `SPICETIFY_EXPOSE_CHUNKS=dir[:dir]` adds the now-playing menu count for
    /// each directory of extracted chunks (an unzipped `xpui.spa`).
    ///
    /// Honours SPICETIFY_EXPOSE_PATCHES, so a candidate patch set can be
    /// measured before it is published. Counts every match even for `once`
    /// patches: those depend on their anchor being unique, and a count above
    /// one is the tell that a Spotify update made it ambiguous.
    #[test]
    #[ignore]
    fn expose_hits_on_real_bundles() {
        let Ok(list) = std::env::var("SPICETIFY_EXPOSE_BUNDLES") else {
            eprintln!("set SPICETIFY_EXPOSE_BUNDLES=path[:path...] to run this");
            return;
        };
        let patches = load_patches(&std::env::temp_dir());
        for path in list.split(':').filter(|p| !p.is_empty()) {
            let src = std::fs::read_to_string(path).expect("bundle readable");
            eprintln!("== {path} ({} bytes)", src.len());
            let (_, cm) = patch_context_menu(src.clone());
            eprintln!(
                "   {:>3}  Context menu provider (patch_context_menu)",
                if cm { "hit" } else { "0" }
            );
            for (spec, re) in &patches.patches {
                let n = re.find_iter(&src).count();
                eprintln!("   {n:>3}  {}{}", spec.name, if spec.once { " (once)" } else { "" });
            }
            let (_, uri) = patch_uri_fallback(src);
            eprintln!("   {:>3}  URI fallback (patch_uri_fallback)", if uri { "hit" } else { "0" });
        }
        let chunk_dirs = std::env::var("SPICETIFY_EXPOSE_CHUNKS").unwrap_or_default();
        for dir in chunk_dirs.split(':').filter(|d| !d.is_empty()) {
            let mut files = Vec::new();
            for entry in std::fs::read_dir(dir).expect("chunk directory readable") {
                let path = entry.expect("chunk entry").path();
                if path.extension().is_some_and(|ext| ext == "js") {
                    let src = std::fs::read_to_string(&path).expect("chunk readable");
                    let n = patch_now_playing_menu(&src)
                        .map_or(0, |out| out.matches("Spicetify.ContextMenuV2._Provider").count());
                    if n > 0 {
                        files.push(format!(
                            "{} x{n}",
                            path.file_name().unwrap_or_default().to_string_lossy()
                        ));
                    }
                }
            }
            files.sort();
            eprintln!("== {dir}: now-playing menu provider in {}", files.join(", "));
        }
    }
}
