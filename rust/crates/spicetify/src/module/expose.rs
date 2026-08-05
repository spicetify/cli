// Apply-time source patches that expose Spotify's internals on the Spicetify
// global. The extracted client bundle is minified and shipped without any
// stable API surface, so the wrapper (src/jsHelper/spicetifyWrapper) can only
// find Platform, URI, Snackbar and friends because these rewrites hang them
// off `Spicetify.*` first.
//
// Ported from the Go CLI's preprocess.exposeAPIs_main / exposeAPIs_vendor
// (src/preprocess/preprocess.go); the patterns are intentionally identical,
// since they are tuned against real minified builds.

use std::sync::LazyLock;

use regex::{Captures, Regex};

struct Patch {
    name: &'static str,
    pattern: &'static str,
    replace: fn(&Captures<'_>) -> String,
    once: bool,
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
        },
        Patch {
            name: "Remove list of exclusive shows",
            pattern: r#"\["spotify:show.+?\]"#,
            replace: |_| "[]".to_string(),
            once: false,
        },
        Patch {
            name: "Remove Star Wars easter eggs",
            pattern: r"\w+\(\)\.createElement\(\w+,\{onChange:this\.handleSaberStateChange\}\),",
            replace: |_| String::new(),
            once: false,
        },
        Patch {
            // The modules are built and tested against a client whose test ids
            // have been stripped, matching the Go CLI.
            name: "Remove data-testid",
            pattern: r#""data-testid":"#,
            replace: |_| "\"\":".to_string(),
            once: false,
        },
        Patch {
            name: "Expose PlatformAPI",
            pattern: r#"((?:setTitlebarHeight|registerFactory)[\w(){}<>:.,&$!=;""?!#%/\- ]+)(\{version:[a-zA-Z_\$][\w\$]*,)"#,
            replace: |c| format!("{}Spicetify._platform={}", group(c, 1), group(c, 2)),
            once: false,
        },
        Patch {
            name: "Redux store",
            pattern: r"(,[\w$]+=)(([$\w,.:=;(){}]+\(\{session:[\w$]+,features:[\w$]+,seoExperiment:[\w$]+\}))",
            replace: |c| format!("{}Spicetify.Platform.ReduxStore={}", group(c, 1), group(c, 2)),
            once: false,
        },
        Patch {
            name: "React Component: Platform Provider",
            pattern: r"(,[$\w]+=)((function\([\w$]{1}\)\{var [\w$]+=[\w$]+\.platform,[\w$]+=[\w$]+\.children,)|(\(\{platform:[\w$]+,children:[\w$]+\}\)=>\{))",
            replace: |c| format!("{}Spicetify.ReactComponent.PlatformProvider={}", group(c, 1), group(c, 2)),
            once: false,
        },
        Patch {
            name: "Prevent breaking popupLyrics",
            pattern: r"document.pictureInPictureElement&&\(\w+.current=[!\w]+,document\.exitPictureInPicture\(\)\),\w+\.current=null",
            replace: |_| String::new(),
            once: false,
        },
        Patch {
            name: "Spotify Custom Snackbar Interfaces (<=1.2.37)",
            pattern: r"\b\w\s*\(\)\s*[^;,]*enqueueCustomSnackbar:\s*(\w)\s*[^;]*;",
            replace: |c| format!("{}Spicetify.Snackbar.enqueueCustomSnackbar={};", group(c, 0), group(c, 1)),
            once: false,
        },
        Patch {
            name: "Spotify Custom Snackbar Interfaces (>=1.2.38)",
            pattern: r"(=)[^=]*\(\)\.enqueueCustomSnackbar;",
            replace: |c| format!("=Spicetify.Snackbar.enqueueCustomSnackbar{};", group(c, 0)),
            once: false,
        },
        Patch {
            name: "Spotify Image Snackbar Interface",
            pattern: r"(=)(\(\({[^}]*,\s*imageSrc)",
            replace: |c| format!("{}Spicetify.Snackbar.enqueueImageSnackbar={}", group(c, 1), group(c, 2)),
            once: false,
        },
        Patch {
            name: "React Component: Navigation for navLinks",
            pattern: r"(;const [\w\d]+=)((?:\(0,[\w\d]+\.memo\))[\(\d,\w\.\){:}=]+=[\d\w]+\.[\d\w]+\.getLocaleForURLPath\(\))",
            replace: |c| format!("{}Spicetify.ReactComponent.Navigation={}", group(c, 1), group(c, 2)),
            once: true,
        },
        Patch {
            name: "Context Menu V2",
            pattern: r#"("Menu".+?children:)([\w$][\w$\d]*)"#,
            replace: |c| {
                format!("{}[Spicetify.ContextMenuV2.renderItems(),{}].flat()", group(c, 1), group(c, 2))
            },
            once: false,
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
        },
        Patch {
            name: "Map styled-components classes",
            pattern: r"(\w+ [\w$_]+)=[\w$_]+\([\w$_]+>>>0\)",
            replace: |c| format!("{}=Spicetify._getStyledClassName(arguments,this)", group(c, 1)),
            once: false,
        },
        Patch {
            name: "Tippy.js",
            pattern: r"([\w\$_]+)\.setDefaultProps=",
            replace: |c| format!("Spicetify.Tippy={};{}", group(c, 1), group(c, 0)),
            once: false,
        },
        Patch {
            name: "Flipper components",
            pattern: r"([\w$]+)=((?:function|\()([\w$.,{}()= ]+(?:springConfig|overshootClamping)){2})",
            replace: |c| format!("{}=Spicetify.ReactFlipToolkit.spring={}", group(c, 1), group(c, 2)),
            once: false,
        },
        Patch {
            name: "Snackbar",
            pattern: r"\w+\s*=\s*\w\.call\(this,[^)]+\)\s*\|\|\s*this\)\.enqueueSnackbar",
            replace: |c| format!("Spicetify.Snackbar={}", group(c, 0)),
            once: false,
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

    let Some(react) = last(r"([a-zA-Z_\$][\w\$]*)\.useRef", 1).map(|g| g[1].clone()) else {
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
        |g| (g[1].clone(), g[2].clone(), g[3].clone()),
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
    let replacement =
        if is_class { format!("{body};Spicetify.URI={name};") } else { format!("{body}();Spicetify.URI={name};") };
    (input.replacen(body, &replacement, 1), true)
}

/// Applies every exposure patch to the extracted client bundle, logging any
/// that stopped matching (the usual symptom of a Spotify update moving code).
#[must_use]
pub(crate) fn expose_apis(input: String) -> String {
    let (mut out, _) = patch_context_menu(input);
    let mut missed = Vec::new();

    for patch in MAIN_PATCHES.iter().chain(VENDOR_PATCHES.iter()) {
        let (next, hit) = apply(out, patch);
        out = next;
        if !hit {
            missed.push(patch.name);
        }
    }

    let (out, _) = patch_uri_fallback(out);
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
        let src = r#"registerFactory(a,b){return c}{version:x,container:y}"#;
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
}
