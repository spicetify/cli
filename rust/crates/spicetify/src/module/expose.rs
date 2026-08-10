// Apply-time source patches that expose Spotify's internals on the Spicetify
// global. The extracted client bundle is minified and shipped without any
// stable API surface, so the wrapper (src/jsHelper/spicetifyWrapper) can only
// find Platform, URI, Snackbar and friends because these rewrites hang them
// off `Spicetify.*` first.
//
// Ported from the Go CLI's preprocess.exposeAPIs_main / exposeAPIs_vendor
// (src/preprocess/preprocess.go), tuned against real minified builds. Where
// a Spotify update reshaped the code, a re-derived variant sits beside the
// original: the old pattern still serves the older builds the classmaps
// cover, and the pair counts as one surface for miss reporting.

use std::sync::LazyLock;

use regex::{Captures, Regex};

/// How a patch that matched nothing is reported.
#[derive(Clone, Copy)]
enum OnMiss {
    /// A miss means a Spotify update moved code and the surface is gone: warn.
    Warn,
    /// The patch is one variant of a surface; warn only when every variant
    /// in the named group missed.
    Group(&'static str),
    /// A miss is expected on current builds (the target feature was removed
    /// from the client, or the wrapper rebuilds the surface at runtime).
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

static MAIN_PATCHES: LazyLock<Vec<Patch>> = LazyLock::new(|| {
    vec![
        Patch {
            name: "showNotification",
            pattern: r"(?:\w+ |,)([\w$]+)=(\([\w$]+=[\w$]+\.dispatch)",
            replace: |c| {
                let name = group(c, 1);
                format!(
                    ";globalThis.Spicetify.showNotification=(message,isError=false,msTimeout)=>{name}({{message,feedbackType:isError?\"ERROR\":\"NOTICE\",msTimeout}});const {name}={}",
                    group(c, 2)
                )
            },
            once: false,
            // the wrapper synthesizes showNotification from
            // Snackbar.enqueueSnackbar at runtime, so a miss here costs nothing
            // on builds where the dispatch shape is gone
            on_miss: OnMiss::Quiet,
        },
        Patch {
            name: "Remove list of exclusive shows",
            pattern: r#"\["spotify:show.+?\]"#,
            replace: |_| "[]".to_string(),
            once: false,
            // the exclusive-shows list left the client bundle in 1.2.9x
            on_miss: OnMiss::Quiet,
        },
        Patch {
            name: "Remove Star Wars easter eggs",
            pattern: r"\w+\(\)\.createElement\(\w+,\{onChange:this\.handleSaberStateChange\}\),",
            replace: |_| String::new(),
            once: false,
            // the saber easter egg left the client bundle
            on_miss: OnMiss::Quiet,
        },
        Patch {
            name: "Expose PlatformAPI",
            pattern: r#"((?:setTitlebarHeight|registerFactory)[\w(){}<>:.,&$!=;""?!#%/\- ]+)(\{version:[a-zA-Z_\$][\w\$]*,)"#,
            replace: |c| format!("{}Spicetify._platform={}", group(c, 1), group(c, 2)),
            once: false,
            on_miss: OnMiss::Warn,
        },
        Patch {
            name: "Redux store",
            pattern: r"(,[\w$]+=)(([$\w,.:=;(){}]+\(\{session:[\w$]+,features:[\w$]+,seoExperiment:[\w$]+\}))",
            replace: |c| format!("{}Spicetify.Platform.ReduxStore={}", group(c, 1), group(c, 2)),
            once: false,
            on_miss: OnMiss::Group("redux-store"),
        },
        Patch {
            // 1.2.9x builds the store inside an IIFE taking two arguments,
            // so the assignment the old pattern keyed on is gone. This one
            // anchors on the only `return (0,createStore)((0,combineReducers)({`
            // whose IIFE is invoked with the session/features/seoExperiment
            // object, and routes the created store through the global.
            name: "Redux store (1.2.9x)",
            pattern: r"return(\(0,[\w$]+\.[\w$]+\)\(\(0,[\w$]+\.[\w$]+\)\(\{(?s:.{0,1500}?)\)\}\(\{session:[\w$]+,features:[\w$]+,seoExperiment:[\w$]+\},\{platform:)",
            replace: |c| format!("return Spicetify.Platform.ReduxStore={}", group(c, 1)),
            once: true,
            on_miss: OnMiss::Group("redux-store"),
        },
        Patch {
            name: "React Component: Platform Provider",
            pattern: r"(,[$\w]+=)((function\([\w$]{1}\)\{var [\w$]+=[\w$]+\.platform,[\w$]+=[\w$]+\.children,)|(\(\{platform:[\w$]+,children:[\w$]+\}\)=>\{))",
            replace: |c| {
                format!("{}Spicetify.ReactComponent.PlatformProvider={}", group(c, 1), group(c, 2))
            },
            once: false,
            on_miss: OnMiss::Warn,
        },
        Patch {
            name: "Prevent breaking popupLyrics",
            pattern: r"document.pictureInPictureElement&&\(\w+.current=[!\w]+,document\.exitPictureInPicture\(\)\),\w+\.current=null",
            replace: |_| String::new(),
            once: false,
            // the PiP-exit block this removed was rewritten out of the client in
            // 1.2.9x
            on_miss: OnMiss::Quiet,
        },
        Patch {
            name: "Spotify Custom Snackbar Interfaces (<=1.2.37)",
            pattern: r"\b\w\s*\(\)\s*[^;,]*enqueueCustomSnackbar:\s*(\w)\s*[^;]*;",
            replace: |c| {
                format!("{}Spicetify.Snackbar.enqueueCustomSnackbar={};", group(c, 0), group(c, 1))
            },
            once: false,
            on_miss: OnMiss::Group("custom-snackbar"),
        },
        Patch {
            name: "Spotify Custom Snackbar Interfaces (>=1.2.38)",
            pattern: r"(=)[^=]*\(\)\.enqueueCustomSnackbar;",
            replace: |c| format!("=Spicetify.Snackbar.enqueueCustomSnackbar{};", group(c, 0)),
            once: false,
            on_miss: OnMiss::Group("custom-snackbar"),
        },
        Patch {
            name: "Spotify Image Snackbar Interface",
            // Go's RE2 allows the bare `{` this pattern carries upstream;
            // the regex crate does not, so it is escaped here.
            pattern: r"(=)(\(\(\{[^}]*,\s*imageSrc)",
            replace: |c| {
                format!("{}Spicetify.Snackbar.enqueueImageSnackbar={}", group(c, 1), group(c, 2))
            },
            once: false,
            on_miss: OnMiss::Group("image-snackbar"),
        },
        Patch {
            // 1.2.9x wraps the enqueue arrow in useCallback, so it is
            // returned from the hook rather than assigned; the old pattern
            // keyed on the assignment.
            name: "Spotify Image Snackbar Interface (1.2.9x)",
            pattern: r"return(\(0,[\w$]+\.useCallback\)\(\(\{message:[\w$]+,\s*imageSrc)",
            replace: |c| format!("return Spicetify.Snackbar.enqueueImageSnackbar={}", group(c, 1)),
            once: false,
            on_miss: OnMiss::Group("image-snackbar"),
        },
        Patch {
            name: "React Component: Navigation for navLinks",
            pattern: r"(;const [\w\d]+=)((?:\(0,[\w\d]+\.memo\))[\(\d,\w\.\){:}=]+=[\d\w]+\.[\d\w]+\.getLocaleForURLPath\(\))",
            replace: |c| {
                format!("{}Spicetify.ReactComponent.Navigation={}", group(c, 1), group(c, 2))
            },
            once: true,
            // the wrapper finds Navigation through webpack at runtime
            // (react-components.js), so a miss here is covered
            on_miss: OnMiss::Quiet,
        },
        Patch {
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
    ]
});

static VENDOR_PATCHES: LazyLock<Vec<Patch>> = LazyLock::new(|| {
    vec![
        Patch {
            name: "Spicetify.URI",
            pattern: r",(\w+)\.prototype\.toAppType",
            replace: |c| format!(",(globalThis.Spicetify.URI={}){}", group(c, 1), group(c, 0)),
            once: false,
            on_miss: OnMiss::Group("uri"),
        },
        Patch {
            name: "Map styled-components classes",
            pattern: r"(\w+ [\w$_]+)=[\w$_]+\([\w$_]+>>>0\)",
            replace: |c| format!("{}=Spicetify._getStyledClassName(arguments,this)", group(c, 1)),
            once: false,
            on_miss: OnMiss::Warn,
        },
        Patch {
            name: "Tippy.js",
            pattern: r"([\w\$_]+)\.setDefaultProps=",
            replace: |c| format!("Spicetify.Tippy={};{}", group(c, 1), group(c, 0)),
            once: false,
            on_miss: OnMiss::Warn,
        },
        Patch {
            name: "Flipper components",
            pattern: r"([\w$]+)=((?:function|\()([\w$.,{}()= ]+(?:springConfig|overshootClamping)){2})",
            replace: |c| {
                format!("{}=Spicetify.ReactFlipToolkit.spring={}", group(c, 1), group(c, 2))
            },
            once: false,
            // react-flip-toolkit left the vendor bundle in 1.2.9x; nothing
            // remains to expose on current builds
            on_miss: OnMiss::Quiet,
        },
        Patch {
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

/// Late URI fallback for builds where the `toAppType` pattern no longer
/// matches: finds the URI class body by scanning balanced braces.
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
    let mut missed: Vec<&Patch> = Vec::new();
    let mut hit_groups: Vec<&'static str> = Vec::new();

    for patch in MAIN_PATCHES.iter().chain(VENDOR_PATCHES.iter()) {
        let (next, hit) = apply(out, patch);
        out = next;
        if hit {
            if let OnMiss::Group(g) = patch.on_miss {
                hit_groups.push(g);
            }
        } else {
            missed.push(patch);
        }
    }

    let (out, fallback_hit) = patch_uri_fallback(out);
    if fallback_hit {
        hit_groups.push("uri");
    }

    let report: Vec<&str> = missed
        .iter()
        .filter(|p| match p.on_miss {
            OnMiss::Warn => true,
            OnMiss::Group(g) => !hit_groups.contains(&g),
            OnMiss::Quiet => false,
        })
        .map(|p| p.name)
        .collect();
    if !report.is_empty() {
        tracing::warn!("api exposure patches that did not match: {}", report.join(", "));
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
    fn exposes_uri_from_the_prototype_pattern() {
        let src = r",n.prototype.toAppType=function(){}";
        let out = expose_apis(src.to_string());
        assert!(out.contains("globalThis.Spicetify.URI=n"), "{out}");
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
        for patch in MAIN_PATCHES.iter().chain(VENDOR_PATCHES.iter()) {
            assert!(Regex::new(patch.pattern).is_ok(), "invalid pattern: {}", patch.name);
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
