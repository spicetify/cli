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
// the binary as the offline baseline. Every patch targets one file: the
// xpui-modules.js extracted from the v8 snapshot (apply.rs). Two rewrites
// stay in Rust because they read identifiers out of the surrounding code
// rather than matching a fixed shape: the context-menu provider and the URI
// class scan.
//
// The `expose_hits_on_real_bundles` test below measures a patch set against
// real extracted bundles; run it whenever a Spotify update lands before
// deciding a pattern is dead or re-deriving one.

use std::path::{Path, PathBuf};

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
            if let Some(n) = template_group_out_of_range(&spec.replace, re.captures_len()) {
                tracing::warn!(
                    "patch {} references group {n} but its pattern has {} group(s): skipped",
                    spec.name,
                    re.captures_len() - 1
                );
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

/// The first `${N}` or `$N` in `template` naming a group the pattern does not
/// have. `Captures::expand` would substitute an empty string there, which is
/// how a typo in a published template would inject broken code into the
/// client; refusing the patch at load turns that into a diagnostic. `$$` is
/// the literal-dollar escape and is skipped.
fn template_group_out_of_range(template: &str, captures_len: usize) -> Option<usize> {
    let bytes = template.as_bytes();
    let mut i = 0;
    while let Some(&b) = bytes.get(i) {
        if b != b'$' {
            i += 1;
            continue;
        }
        if bytes.get(i + 1) == Some(&b'$') {
            i += 2;
            continue;
        }
        let braced = bytes.get(i + 1) == Some(&b'{');
        let start = if braced { i + 2 } else { i + 1 };
        let digits: String = bytes
            .get(start..)
            .unwrap_or_default()
            .iter()
            .take_while(|b| b.is_ascii_digit())
            .map(|&b| char::from(b))
            .collect();
        let end = start + digits.len();
        if !digits.is_empty()
            && (!braced || bytes.get(end) == Some(&b'}'))
            && let Ok(n) = digits.parse::<usize>()
            && n >= captures_len
        {
            return Some(n);
        }
        i = end.max(i + 1);
    }
    None
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
    let Ok(crop_re) = Regex::new(r#".*(?:value:"contextmenu"|"[^"]*":"context-menu")"#) else {
        return (input, false);
    };
    let Some(cropped) = crop_re.find(&input).map(|m| m.as_str().to_string()) else {
        return (input, false);
    };

    let last = |pattern: &str, n: usize| -> Option<Vec<String>> {
        let re = Regex::new(pattern).ok()?;
        let caps = re.captures_iter(&cropped).last()?;
        Some((0..=n).map(|i| group(&caps, i)).collect())
    };

    let pick = |g: &[String], i: usize| g.get(i).cloned().unwrap_or_default();

    let Some(react) = last(r"([a-zA-Z_\$][\w\$]*)\.useRef", 1).map(|g| pick(&g, 1)) else {
        return (input, false);
    };

    let (menu, trigger, target) = last(
        r"([a-zA-Z_\$][\w\$]*)=[\w_$]+\.menu[^}]*,([a-zA-Z_\$][\w\$]*)=[\w_$]+\.trigger[^}]*,([a-zA-Z_\$][\w\$]*)=[\w_$]+\.triggerRef",
        3,
    )
    .or_else(|| {
        last(
            r"\(\{[^}]*menu:([a-zA-Z_\$][\w\$]*),[^}]*trigger:([a-zA-Z_\$][\w\$]*),[^}]*triggerRef:([a-zA-Z_\$][\w\$]*)",
            3,
        )
    })
    .map_or_else(
        || ("e.menu".to_string(), "e.trigger".to_string(), "e.triggerRef".to_string()),
        |g| (pick(&g, 1), pick(&g, 2), pick(&g, 3)),
    );

    let Ok(re) = Regex::new(
        r#"\(0,([\w_$]+)\.jsx\)\((?:[\w_$]+\.[\w_$]+,\{value:"contextmenu"[^}]+\}\)\}\)|"[\w-]+",\{[^}]+:"context-menu"[^}]+\}\))"#,
    ) else {
        return (input, false);
    };
    let mut hit = false;
    let out = re
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
    if input.contains("Spicetify.URI") {
        return (input, false);
    }
    let Ok(re) = Regex::new(
        r"(?:class ([\w$_]+)\{constructor|([\w$_]+)=function\(\)\{function ?[\w$_]+)\([\w$.,={}]+\)\{[\w !?:=.,>&(){}\[\];]*this\.hasBase62Id",
    ) else {
        return (input, false);
    };
    let Some(caps) = re.captures(&input) else {
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
        assert_eq!(template_group_out_of_range("${0}${1}", 2), None);
        assert_eq!(template_group_out_of_range("$$2", 2), None);
        assert_eq!(template_group_out_of_range("${2}", 2), Some(2));
        assert_eq!(template_group_out_of_range("a$9b", 2), Some(9));
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
    }
}
