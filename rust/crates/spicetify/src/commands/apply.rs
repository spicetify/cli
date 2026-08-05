use std::path::Path;

use crate::context::AppContext;
use crate::error::Result;
use crate::{fl, util};

pub(crate) fn run(ctx: &AppContext) -> Result<()> {
    let dest_apps = ctx.dest_apps_path();
    let spa = ctx.spotify_apps_path().join("xpui.spa");
    let dest_xpui = dest_apps.join("xpui");
    let backup = spa.with_extension("spa.backup");

    if !spa.exists() && dest_xpui.exists() {
        return Err(anyhow::anyhow!(fl!("already-applied")));
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

    if dest_xpui.exists() {
        std::fs::remove_dir_all(&dest_xpui)?;
    }
    std::fs::rename(&tmp, &dest_xpui)?;

    if let Err(e) = super::daemon::install() {
        tracing::warn!(error = %e, "failed to install daemon auto-start");
    }

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
    let snapshot = find_snapshot(spotify_data)
        .or_else(|_| find_snapshot(offline_bnk_dir))?
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
    std::fs::write(dest.join("xpui-modules.js"), &js)?;
    Ok(())
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

fn patch_index(dest: &Path) -> Result<()> {
    let index = dest.join("index.html");
    let raw = std::fs::read_to_string(&index)?;
    let patched = patch_index_html(&raw)?;
    std::fs::write(&index, patched)?;
    Ok(())
}

fn link_runtime_dirs(config_root: &Path, dest: &Path) -> Result<()> {
    for folder in ["hooks", "modules", "store"] {
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

fn patch_index_html(input: &str) -> Result<String> {
    let app_version = env!("CARGO_PKG_VERSION");
    let target = "<script defer=\"defer\" src=\"/xpui-snapshot.js\"></script>";
    let version_script =
        format!(r#"<script>globalThis.__SPICETIFY_APP_VERSION__="{app_version}";</script>"#);
    let hooks_script = r#"<script type="module" src="./hooks/index.js"></script>"#;
    let replacement = format!("{version_script}{hooks_script}");
    let idx = input.find(target).ok_or_else(|| anyhow::anyhow!(fl!("index-patch-not-found")))?;
    Ok(format!("{}{}{}", &input[..idx], replacement, &input[idx + target.len()..]))
}
