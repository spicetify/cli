use std::path::Path;

use crate::context::AppContext;
use crate::error::Result;
use crate::{fl, util};

pub(crate) fn run(ctx: &AppContext) -> Result<()> {
    let dest_apps = ctx.dest_apps_path();
    let spa = ctx.spotify_apps_path().join("xpui.spa");
    let dest_xpui = dest_apps.join("xpui");
    let backup = spa.with_extension("spa.backup");

    // The artifacts alone distinguish three states:
    //   xpui.spa present           -> stock; fresh apply
    //   xpui.spa.backup present    -> ours; re-apply from that backup
    //   neither, but xpui/ present -> patched by another tool, which consumed
    //                                 the archive entirely. Patching over it
    //                                 would corrupt the client, so refuse and
    //                                 name the real cause instead of claiming
    //                                 it is already applied.
    if !spa.exists() && !ctx.mirror && !backup.exists() && dest_xpui.exists() {
        return Err(anyhow::anyhow!(fl!("foreign-apply")));
    }

    crate::lifecycle::stop(ctx)?;

    if !spa.exists() && !ctx.mirror && backup.exists() {
        tracing::info!("{}", fl!("restoring-spa-backup", path = spa.to_string_lossy()));
        std::fs::rename(&backup, &spa)?;
    }

    std::fs::create_dir_all(&dest_apps)?;
    tracing::info!(
        "{}",
        fl!("extracting-spa", src = spa.to_string_lossy(), dest = dest_xpui.to_string_lossy())
    );

    let tmp = dest_apps.join("xpui.tmp");
    if tmp.exists() {
        cleanup_tmp(&tmp);
    }

    if let Err(e) = extract_into(&spa, &tmp) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    if !ctx.mirror {
        if let Err(e) = std::fs::remove_file(&backup)
            && e.kind() != std::io::ErrorKind::NotFound
        {
            tracing::warn!(error = %e, path = %backup.display(), "failed to remove file");
        }
        if let Err(e) = std::fs::rename(&spa, &backup) {
            cleanup_tmp(&tmp);
            return Err(anyhow::anyhow!("failed to backup xpui.spa: {e}"));
        }
    }

    tracing::info!("{}", fl!("patching-index"));
    if let Err(e) = patch_index(&tmp) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    if let Err(e) = extract_modules(&ctx.spotify_data_dir, &ctx.offline_bnk_dir, &tmp) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    if let Err(e) = link_runtime_dirs(&ctx.config_root, &tmp) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    if let Err(e) = stage_modules(ctx, &tmp) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    if dest_xpui.exists() {
        std::fs::remove_dir_all(&dest_xpui)?;
    }
    std::fs::rename(&tmp, &dest_xpui)?;

    // The daemon is not auto-installed here: its update watcher would race
    // apply/restore drills while the watcher's exactly-once sequencing is
    // still being built. `spicetify daemon install` remains explicit.

    crate::lifecycle::start(ctx)?;

    crate::platform::register_url_scheme();

    tracing::info!("{}", fl!("applied-patches"));
    Ok(())
}

fn cleanup_tmp(tmp: &Path) {
    if let Err(e) = std::fs::remove_dir_all(tmp) {
        tracing::warn!(error = %e, path = %tmp.display(), "failed to clean up temp dir");
    }
}

fn extract_into(spa: &Path, dest: &Path) -> Result<()> {
    if !spa.exists() {
        return Err(anyhow::anyhow!(fl!("xpui-not-found", path = spa.to_string_lossy())));
    }
    util::unzip_file(spa, dest).map_err(|e| anyhow::anyhow!("failed to extract spa: {e}"))?;
    Ok(())
}

fn extract_modules(spotify_data: &Path, offline_bnk_dir: &Path, dest: &Path) -> Result<()> {
    let snapshot = locate_snapshot(spotify_data, offline_bnk_dir)
        .ok_or_else(|| anyhow::anyhow!(fl!("snapshot-not-found")))?;

    let data = std::fs::read(&snapshot)?;
    let js =
        util::extract_utf16le_between(&data, "var __webpack_modules__={", "xpui-modules.js.map")
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "could not locate xpui-modules.js.map markers in v8 snapshot at {}",
                    snapshot.display()
                )
            })?;
    let patched = crate::module::expose::expose_apis(js);
    std::fs::write(dest.join("xpui-modules.js"), patched)?;
    Ok(())
}

// Search order: the Spotify data dir, then platform-specific locations (macOS
// keeps the snapshot inside the CEF framework bundle), then the offline-bnk
// cache. A missing directory is skipped rather than fatal.
fn locate_snapshot(spotify_data: &Path, offline_bnk_dir: &Path) -> Option<std::path::PathBuf> {
    let mut dirs = vec![spotify_data.to_path_buf()];
    dirs.extend(crate::platform::snapshot_dirs());
    dirs.push(offline_bnk_dir.to_path_buf());
    dirs.iter().find_map(|dir| find_snapshot(dir).ok().flatten())
}

fn find_snapshot(dir: &Path) -> Result<Option<std::path::PathBuf>> {
    let entry = std::fs::read_dir(dir)?.filter_map(std::io::Result::ok).find(|e| {
        e.file_name().to_str().is_some_and(|n| {
            n.starts_with("v8_context_snapshot")
                && n.len() > 4
                && n[n.len() - 4..].eq_ignore_ascii_case(".bin")
        })
    });
    Ok(entry.map(|e| e.path()))
}

// The modular loader boots from <xpui>/modules/manifest.json, which carries the
// classmap for this Spotify build alongside each module's metadata.
fn stage_modules(ctx: &AppContext, dest: &Path) -> Result<()> {
    let modules_root = crate::module::modules_dir(&ctx.config_root);
    let version = crate::hooks::version_detect::detect_spotify_version(ctx)
        .map(|v| v.to_string())
        .unwrap_or_default();
    if version.is_empty() {
        tracing::warn!("cannot detect the Spotify version: skipping module staging");
        return Ok(());
    }

    match crate::module::stage::stage_modules(
        &ctx.config_root,
        &modules_root,
        dest,
        &version,
        env!("CARGO_PKG_VERSION"),
    ) {
        Ok(0) => {
            tracing::warn!("no modules staged: the client will boot without them");
            Ok(())
        }
        Ok(n) => {
            tracing::info!("staged {n} module(s)");
            Ok(())
        }
        Err(e) => Err(e),
    }
}

fn patch_index(dest: &Path) -> Result<()> {
    let index = dest.join("index.html");
    let raw = std::fs::read_to_string(&index)?;
    let patched = patch_index_html(&raw)?;
    std::fs::write(&index, patched)?;
    Ok(())
}

// Modules are staged (copied and classmap-remapped) rather than linked, so
// `modules` is deliberately absent here: see stage_modules.
fn link_runtime_dirs(config_root: &Path, dest: &Path) -> Result<()> {
    for folder in ["hooks", "store"] {
        let src = config_root.join(folder);
        let dst = dest.join(folder);
        tracing::info!(
            "{}",
            fl!("linking-dir", dst = dst.to_string_lossy(), src = src.to_string_lossy())
        );
        if !src.exists() {
            std::fs::create_dir_all(&src)?;
        }
        util::create_dir_link(&src, &dst)?;
    }
    Ok(())
}

// The payload is injected as classic, non-deferred scripts at the top of
// <body>: the wrapper must run before the client bundle to intercept webpack,
// and a module script would be deferred until after it. The stock snapshot tag
// is stripped because the modular loader boots the client itself once mixins
// have run (it re-injects /xpui-modules.js then /xpui-snapshot.js).
const SNAPSHOT_TAG: &str = "<script defer=\"defer\" src=\"/xpui-snapshot.js\"></script>";
const BODY_TAG: &str = "<body>";

fn patch_index_html(input: &str) -> Result<String> {
    let app_version = env!("CARGO_PKG_VERSION");
    if !input.contains(SNAPSHOT_TAG) {
        return Err(anyhow::anyhow!(fl!("index-patch-not-found")));
    }
    let body = input.find(BODY_TAG).ok_or_else(|| anyhow::anyhow!(fl!("index-patch-not-found")))?;
    let insert_at = body + BODY_TAG.len();

    let payload = format!(
        concat!(
            "\n<script>globalThis.__SPICETIFY_APP_VERSION__=\"{}\";</script>\n",
            "<script src='hooks/spicetifyWrapper.js'></script>\n",
            "<!-- spicetify helpers -->\n",
            "<script src='hooks/modularLoader.js'></script>\n"
        ),
        app_version
    );

    let patched = format!("{}{}{}", &input[..insert_at], payload, &input[insert_at..]);
    Ok(patched.replace(SNAPSHOT_TAG, ""))
}

#[cfg(test)]
mod tests {
    use super::*;

    const STOCK: &str = r#"<!doctype html><html><head><title>Spotify</title></head><body><div class="body-drag-top"></div><script defer="defer" src="/xpui-snapshot.js"></script></body></html>"#;

    #[test]
    fn injects_payload_and_strips_snapshot_tag() {
        let out = patch_index_html(STOCK).expect("stock index patches");
        assert!(out.contains("<script src='hooks/spicetifyWrapper.js'></script>"));
        assert!(out.contains("<script src='hooks/modularLoader.js'></script>"));
        assert!(out.contains("__SPICETIFY_APP_VERSION__"));
        assert!(!out.contains(SNAPSHOT_TAG), "loader re-injects the snapshot itself");
    }

    #[test]
    fn wrapper_runs_before_the_client_bundle() {
        let out = patch_index_html(STOCK).expect("stock index patches");
        let wrapper = out.find("hooks/spicetifyWrapper.js").expect("wrapper injected");
        let loader = out.find("hooks/modularLoader.js").expect("loader injected");
        let body = out.find(BODY_TAG).expect("body present");
        assert!(body < wrapper && wrapper < loader, "payload order must be body -> wrapper -> loader");
        // Nothing may be deferred: defer would run after the client bundle.
        assert!(!out.contains("defer src='hooks/"));
    }

    #[test]
    fn refuses_an_index_without_the_snapshot_anchor() {
        let already = "<html><body></body></html>";
        assert!(patch_index_html(already).is_err(), "an unrecognised index must not be patched");
    }
}
