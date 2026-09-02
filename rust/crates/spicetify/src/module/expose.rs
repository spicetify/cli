// Apply-time source patches that expose Spotify's internals on the Spicetify
// global. The extracted client bundle is minified and shipped without any
// stable API surface, so the wrapper (src/jsHelper/spicetifyWrapper) can only
// find Platform, URI, Snackbar and friends because these rewrites hang them
// off `Spicetify.*` first.
//
// Every patch targets one file: xpui-modules.js, extracted from the v8
// snapshot (apply.rs). The Go-era split between an xpui.js and a vendor
// bundle is gone from every build the CLI supports (MIN_SUPPORTED_SPOTIFY in
// hooks/version_detect.rs), so there is one list, and a patch earns its place
// by matching a supported build rather than by the era it was written for.
// The `expose_hits_on_real_bundles` test below measures exactly that against
// real extracted bundles; run it whenever a Spotify update lands before
// deciding a pattern is dead or re-deriving one.

use std::sync::LazyLock;

use regex::{Captures, Regex};

/// How a patch that matched nothing is reported.
#[derive(Clone, Copy)]
enum OnMiss {
    /// A miss means a Spotify update moved code and the surface is gone: warn.
    Warn,
    /// A miss is expected on some supported builds (the target left the
    /// client, or the wrapper rebuilds the surface at runtime).
    Quiet,
}

struct Patch {
    name: &'static str,
    pattern: &'static str,
    replace: fn(&Captures<'_>) -> String,
    once: bool,
    on_miss: OnMiss,
}

fn group(caps: &Captures<'_>, i: usize) -> String {
    caps.get(i).map_or_else(String::new, |m| m.as_str().to_string())
}

/// Applies one patch, reporting whether it matched so a caller can log the
/// ones that silently stopped matching after a Spotify update.
fn apply(input: String, patch: &Patch) -> (String, bool) {
    let Ok(re) = Regex::new(patch.pattern) else {
        tracing::warn!("patch {} has an invalid pattern: skipped", patch.name);
        return (input, false);
    };
    let mut hit = false;
    let out = if patch.once {
        let mut done = false;
        re.replace_all(&input, |caps: &Captures<'_>| {
            if done {
                return group(caps, 0);
            }
            done = true;
            hit = true;
            (patch.replace)(caps)
        })
        .into_owned()
    } else {
        re.replace_all(&input, |caps: &Captures<'_>| {
            hit = true;
            (patch.replace)(caps)
        })
        .into_owned()
    };
    (out, hit)
}

// Hit counts per patch on real bundles, measured 2026-09-02 with the
// harness below (1.2.84 = last pre-rspack Linux build, 1.2.96 = current):
// a patch that matched neither was removed.
static PATCHES: LazyLock<Vec<Patch>> = LazyLock::new(|| {
    vec![
        Patch {
            // 1.2.84: 1, 1.2.96: 1
            name: "Expose PlatformAPI",
            pattern: r#"((?:setTitlebarHeight|registerFactory)[\w(){}<>:.,&$!=;""?!#%/\- ]+)(\{version:[a-zA-Z_\$][\w\$]*,)"#,
            replace: |c| format!("{}Spicetify._platform={}", group(c, 1), group(c, 2)),
            once: false,
            on_miss: OnMiss::Warn,
        },
        Patch {
            // 1.2.84: 0, 1.2.96: 1. The store is created inside an IIFE
            // invoked with the session/features/seoExperiment object; this
            // anchors on the only `return (0,createStore)((0,combineReducers)({`
            // in that IIFE and routes the created store through the global.
            // 1.2.84 builds the store another way and has no seoExperiment
            // key at all, so ReduxStore is not exposed there yet.
            name: "Redux store",
            pattern: r"return(\(0,[\w$]+\.[\w$]+\)\(\(0,[\w$]+\.[\w$]+\)\(\{(?s:.{0,1500}?)\)\}\(\{session:[\w$]+,features:[\w$]+,seoExperiment:[\w$]+\},\{platform:)",
            replace: |c| format!("return Spicetify.Platform.ReduxStore={}", group(c, 1)),
            once: true,
            on_miss: OnMiss::Warn,
        },
        Patch {
            // 1.2.84: 0, 1.2.96: 2
            name: "React Component: Platform Provider",
            pattern: r"(,[$\w]+=)((function\([\w$]{1}\)\{var [\w$]+=[\w$]+\.platform,[\w$]+=[\w$]+\.children,)|(\(\{platform:[\w$]+,children:[\w$]+\}\)=>\{))",
            replace: |c| {
                format!("{}Spicetify.ReactComponent.PlatformProvider={}", group(c, 1), group(c, 2))
            },
            once: false,
            on_miss: OnMiss::Warn,
        },
        Patch {
            // 1.2.84: 1, 1.2.96: 1
            name: "Spotify Custom Snackbar Interface",
            pattern: r"\b\w\s*\(\)\s*[^;,]*enqueueCustomSnackbar:\s*(\w)\s*[^;]*;",
            replace: |c| {
                format!("{}Spicetify.Snackbar.enqueueCustomSnackbar={};", group(c, 0), group(c, 1))
            },
            once: false,
            on_miss: OnMiss::Warn,
        },
        Patch {
            // 1.2.84: 1, 1.2.96: 1. The enqueue arrow is returned through
            // useCallback rather than assigned.
            name: "Spotify Image Snackbar Interface",
            pattern: r"return(\(0,[\w$]+\.useCallback\)\(\(\{message:[\w$]+,\s*imageSrc)",
            replace: |c| format!("return Spicetify.Snackbar.enqueueImageSnackbar={}", group(c, 1)),
            once: false,
            on_miss: OnMiss::Warn,
        },
        Patch {
            // 1.2.84: 1, 1.2.96: 0. The wrapper finds Navigation through
            // webpack at runtime (react-components.js), so a miss is covered.
            name: "React Component: Navigation for navLinks",
            pattern: r"(;const [\w\d]+=)((?:\(0,[\w\d]+\.memo\))[\(\d,\w\.\){:}=]+=[\d\w]+\.[\d\w]+\.getLocaleForURLPath\(\))",
            replace: |c| {
                format!("{}Spicetify.ReactComponent.Navigation={}", group(c, 1), group(c, 2))
            },
            once: true,
            on_miss: OnMiss::Quiet,
        },
        Patch {
            // 1.2.84: 1, 1.2.96: 1
            name: "Context Menu V2",
            pattern: r#"("Menu".+?children:)([\w$][\w$\d]*)"#,
            replace: |c| {
                format!(
                    "{}[Spicetify.ContextMenuV2.renderItems(),{}].flat()",
                    group(c, 1),
                    group(c, 2)
                )
            },
            once: false,
            on_miss: OnMiss::Warn,
        },
        Patch {
            // 1.2.84: 1, 1.2.96: 1
            name: "Map styled-components classes",
            pattern: r"(\w+ [\w$_]+)=[\w$_]+\([\w$_]+>>>0\)",
            replace: |c| format!("{}=Spicetify._getStyledClassName(arguments,this)", group(c, 1)),
            once: false,
            on_miss: OnMiss::Warn,
        },
        Patch {
            // 1.2.84: 2, 1.2.96: 2
            name: "Tippy.js",
            pattern: r"([\w\$_]+)\.setDefaultProps=",
            replace: |c| format!("Spicetify.Tippy={};{}", group(c, 1), group(c, 0)),
            once: false,
            on_miss: OnMiss::Warn,
        },
        Patch {
            // 1.2.84: 1, 1.2.96: 0. react-flip-toolkit left the client in
            // 1.2.9x; nothing remains to expose there.
            name: "Flipper components",
            pattern: r"([\w$]+)=((?:function|\()([\w$.,{}()= ]+(?:springConfig|overshootClamping)){2})",
            replace: |c| {
                format!("{}=Spicetify.ReactFlipToolkit.spring={}", group(c, 1), group(c, 2))
            },
            once: false,
            on_miss: OnMiss::Quiet,
        },
        Patch {
            // 1.2.84: 1, 1.2.96: 1
            name: "Snackbar",
            pattern: r"\w+\s*=\s*\w\.call\(this,[^)]+\)\s*\|\|\s*this\)\.enqueueSnackbar",
            replace: |c| format!("Spicetify.Snackbar={}", group(c, 0)),
            once: false,
            on_miss: OnMiss::Warn,
        },
    ]
});

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
/// A miss is only reported when it is actionable: quiet patches never warn,
/// and a grouped patch warns only if its whole group missed.
#[must_use]
pub(crate) fn expose_apis(input: String) -> String {
    let (mut out, _) = patch_context_menu(input);
    let mut missed: Vec<&'static str> = Vec::new();

    for patch in PATCHES.iter() {
        let (next, hit) = apply(out, patch);
        out = next;
        if !hit && matches!(patch.on_miss, OnMiss::Warn) {
            missed.push(patch.name);
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

    #[test]
    fn exposes_the_platform_object() {
        let src = "registerFactory(a,b){return c}{version:x,container:y}";
        let out = expose_apis(src.to_string());
        assert!(out.contains("Spicetify._platform={version:"), "{out}");
    }

    #[test]
    fn exposes_uri_by_scanning_the_class_body() {
        let src = "class n{constructor(e){this.hasBase62Id=!0}}";
        let out = expose_apis(src.to_string());
        assert!(out.contains("Spicetify.URI=n;"), "{out}");
    }

    #[test]
    fn exposes_tippy_defaults() {
        let out = expose_apis("q.setDefaultProps=function(){}".to_string());
        assert!(out.contains("Spicetify.Tippy=q;"), "{out}");
    }

    #[test]
    fn leaves_unrelated_source_untouched() {
        let src = "const a = 1; function b(){ return 2; }";
        assert_eq!(expose_apis(src.to_string()), src);
    }

    #[test]
    fn every_pattern_compiles() {
        // Patterns ported from Go are written for RE2, which is laxer than
        // the regex crate (e.g. a bare `{` literal); a pattern that fails to
        // compile is skipped at apply time with only a log line to show for
        // it, so catch that here instead.
        for patch in PATCHES.iter() {
            assert!(Regex::new(patch.pattern).is_ok(), "invalid pattern: {}", patch.name);
        }
    }

    /// Reports each patch's hit count against real extracted bundles, the
    /// question every Spotify update raises. Run by hand:
    ///
    /// ```sh
    /// SPICETIFY_EXPOSE_BUNDLES=/path/xpui-modules-a.js:/path/xpui-modules-b.js \
    ///   cargo test -p spicetify expose_hits_on_real_bundles -- --ignored --nocapture
    /// ```
    #[test]
    #[ignore = "needs real bundles via SPICETIFY_EXPOSE_BUNDLES"]
    fn expose_hits_on_real_bundles() {
        let Ok(paths) = std::env::var("SPICETIFY_EXPOSE_BUNDLES") else {
            eprintln!("SPICETIFY_EXPOSE_BUNDLES unset; nothing to measure");
            return;
        };
        for path in paths.split(':').filter(|p| !p.is_empty()) {
            let src = std::fs::read_to_string(path).expect("bundle readable");
            eprintln!("== {path} ({} bytes)", src.len());
            let (_, cm) = patch_context_menu(src.clone());
            eprintln!("{:>6}  {}", if cm { "hit" } else { "MISS" }, "Context menu provider (patch_context_menu)");
            for patch in PATCHES.iter() {
                let re = Regex::new(patch.pattern).expect("pattern compiles");
                let n = re.find_iter(&src).count();
                eprintln!("{:>6}  {}", n, patch.name);
            }
            let (_, uri) = patch_uri_fallback(src);
            eprintln!("{:>6}  {}", if uri { "hit" } else { "MISS" }, "URI fallback (patch_uri_fallback)");
        }
    }

    #[test]
    fn exposes_the_redux_store_from_the_iife_shape() {
        // 1.2.9x: the store is created inside an IIFE invoked with the
        // session/features/seoExperiment object as its first argument.
        let src = "return(0,a.y$)((0,a.HY)({playback:p,session:s}),e,m((0,a.Tw)(...n)))}({session:k,features:S,seoExperiment:w},{platform:g,history:h})";
        let out = expose_apis(src.to_string());
        assert!(out.contains("return Spicetify.Platform.ReduxStore=(0,a.y$)("), "{out}");
    }

    #[test]
    fn exposes_the_image_snackbar_from_the_hook_shape() {
        // 1.2.9x: the enqueue arrow is returned through useCallback instead
        // of being assigned.
        let src = "function d(){let{enqueueCustomSnackbar:e}=(0,c.i)();return(0,n.useCallback)(({message:t,imageSrc:i})=>{e(t)},[e])}";
        let out = expose_apis(src.to_string());
        assert!(
            out.contains("return Spicetify.Snackbar.enqueueImageSnackbar=(0,n.useCallback)("),
            "{out}"
        );
    }
}
