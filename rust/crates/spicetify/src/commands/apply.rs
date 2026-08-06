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

    if let Err(e) = stage_payload(&ctx.config_root, &tmp) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    if let Err(e) = stage_modules(ctx, &tmp) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    // Last, so the rename reaches the staged modules too: they carry hashed
    // class names from the classmap, and this pass renames those same hashes
    // inside the client. Rewriting only one side leaves module elements
    // pointing at classes that no longer exist, so they render unstyled.
    if let Err(e) = apply_css_map(ctx, &tmp) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    if dest_xpui.exists() {
        std::fs::remove_dir_all(&dest_xpui)?;
    }
    std::fs::rename(&tmp, &dest_xpui)?;

    ensure_daemon(ctx);

    crate::lifecycle::start(ctx)?;

    crate::platform::register_url_scheme();

    tracing::info!("{}", fl!("applied-patches"));
    Ok(())
}

// The daemon re-applies spicetify after Spotify updates itself, which is the
// whole point of having one, so apply keeps it installed and running unless
// `daemon = false` says otherwise. Failing to start it never fails the apply.
fn ensure_daemon(ctx: &AppContext) {
    if !ctx.daemon {
        tracing::info!(
            "daemon disabled in config: spicetify will not re-apply itself after a Spotify update"
        );
        return;
    }

    if let Err(e) = super::daemon::install() {
        tracing::warn!(error = %e, "could not enable the daemon at login");
    }
    if crate::daemon::is_daemon_running() {
        return;
    }
    if let Err(e) = super::daemon::start() {
        tracing::warn!(error = %e, "could not start the daemon");
    }
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

// Rewrites the client's hashed class names to the stable semantic names the
// ecosystem targets. Without it every `.main-*` selector misses: stdlib's
// registers have nothing to anchor to and themes style nothing.
fn apply_css_map(ctx: &AppContext, dest: &Path) -> Result<()> {
    let version = crate::hooks::version_detect::detect_spotify_version(ctx)
        .map(|v| v.to_string())
        .unwrap_or_default();
    let key = crate::module::stage::classmap_key_for_version(&version).unwrap_or_default();

    let Some(map) = crate::module::cssmap::CssMap::load(&ctx.config_root, &key) else {
        tracing::warn!(
            "no css map found: the client keeps its hashed class names, so `.main-*` selectors will not match"
        );
        return Ok(());
    };
    let touched = crate::module::cssmap::apply_to_tree(&map, dest)?;
    tracing::info!("rewrote class names in {touched} file(s)");
    Ok(())
}

// Classmaps are published per Spotify build, so apply pulls the current one
// before staging. A failure here is not fatal: whatever is already cached (or
// shipped) still applies, which keeps apply working offline.
fn refresh_classmap(ctx: &AppContext, version: &str) {
    if std::env::var_os("SPICETIFY_CLASSMAPS_DIR").is_some() {
        tracing::debug!("SPICETIFY_CLASSMAPS_DIR is set: skipping the classmap fetch");
        return;
    }
    let Some(wanted) = crate::module::stage::classmap_key_for_version(version) else {
        return;
    };
    match crate::module::remote::fetch_classmap(&ctx.config_root, &wanted) {
        Ok(key) if key == wanted => tracing::info!("classmap {key} is current"),
        Ok(key) => tracing::info!("no published classmap for {wanted}; cached {key} instead"),
        Err(e) => {
            tracing::warn!(error = %e, "could not refresh the classmap; using what is cached");
        }
    }
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

    refresh_classmap(ctx, &version);

    let updates_blocked = super::updates::is_blocked(ctx).unwrap_or(false);

    match crate::module::stage::stage_modules(
        &ctx.config_root,
        &modules_root,
        dest,
        &version,
        env!("CARGO_PKG_VERSION"),
        updates_blocked,
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
    let src = config_root.join("store");
    let dst = dest.join("store");
    tracing::info!(
        "{}",
        fl!("linking-dir", dst = dst.to_string_lossy(), src = src.to_string_lossy())
    );
    if !src.exists() {
        std::fs::create_dir_all(&src)?;
    }
    util::create_dir_link(&src, &dst)?;
    Ok(())
}

// The wrapper and loader the patched index.html loads: the embedded copy,
// unless the config root holds a marked developer payload.
fn stage_payload(config_root: &Path, dest: &Path) -> Result<()> {
    let local = config_root.join("hooks");
    let hooks = dest.join("hooks");

    if crate::payload::is_local_override(&local) {
        tracing::warn!(
            path = %local.display(),
            "using a local developer payload instead of the embedded one"
        );
        util::create_dir_link(&local, &hooks)?;
        return Ok(());
    }

    crate::payload::write_into(&hooks)?;
    tracing::info!("staged the embedded client payload");
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
        assert!(
            body < wrapper && wrapper < loader,
            "payload order must be body -> wrapper -> loader"
        );
        // Nothing may be deferred: defer would run after the client bundle.
        assert!(!out.contains("defer src='hooks/"));
    }

    #[test]
    fn refuses_an_index_without_the_snapshot_anchor() {
        let already = "<html><body></body></html>";
        assert!(patch_index_html(already).is_err(), "an unrecognised index must not be patched");
    }
}
