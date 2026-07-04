use std::path::Path;

use crate::context::AppContext;
use crate::error::{Result, http_error, wrap_error};
use crate::{fl, util};

#[cfg(target_os = "linux")]
fn register_url_scheme() {
    let Ok(exe) = std::env::current_exe() else {
        return;
    };
    let Some(base_dirs) = directories::BaseDirs::new() else {
        return;
    };
    let apps_dir = base_dirs.home_dir().join(".local/share/applications");
    if let Err(e) = std::fs::create_dir_all(&apps_dir) {
        tracing::warn!(error = %e, "failed to create applications dir for URL scheme");
        return;
    }
    let desktop = format!(
        "[Desktop Entry]\nType=Application\nName=Spicetify Protocol Handler\nExec={} protocol \
         %u\nStartupNotify=false\nMimeType=x-scheme-handler/spicetify;\nNoDisplay=true\n",
        exe.display()
    );
    if let Err(e) = std::fs::write(apps_dir.join("spicetify-protocol.desktop"), desktop) {
        tracing::warn!(error = %e, "failed to write desktop file for URL scheme");
    }
}

pub fn run(ctx: &AppContext) -> Result<()> {
    let dest_apps = ctx.dest_apps_path();
    let spa = ctx.spotify_apps_path().join("xpui.spa");
    let dest_xpui = dest_apps.join("xpui");
    let backup = spa.with_extension("spa.backup");

    if !spa.exists() && dest_xpui.exists() {
        return Err(http_error(409, fl!("already-applied")));
    }

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

    tracing::info!("{}", fl!("patching-index"));
    if let Err(e) = patch_index(&tmp) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    if let Err(e) = extract_modules(&ctx.spotify_data_path, &ctx.offline_bnk_dir, &tmp) {
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

    if !ctx.mirror {
        if let Err(e) = std::fs::remove_file(&backup)
            && e.kind() != std::io::ErrorKind::NotFound
        {
            tracing::warn!(error = %e, path = %backup.display(), "failed to remove file");
        }
        std::fs::rename(&spa, &backup)?;
    }

    #[cfg(target_os = "linux")]
    register_url_scheme();

    Ok(())
}

fn cleanup_tmp(tmp: &Path) {
    if let Err(e) = std::fs::remove_dir_all(tmp) {
        tracing::warn!(error = %e, path = %tmp.display(), "failed to clean up temp dir");
    }
}

fn extract_into(spa: &Path, dest: &Path) -> Result<()> {
    if !spa.exists() {
        return Err(http_error(400, fl!("xpui-not-found", path = spa.to_string_lossy())));
    }

    util::unzip_file(spa, dest).map_err(|e| wrap_error(anyhow::anyhow!(e), 500))?;
    Ok(())
}

fn extract_modules(spotify_data: &Path, offline_bnk_dir: &Path, dest: &Path) -> Result<()> {
    let snapshot = find_snapshot(spotify_data)
        .or_else(|_| find_snapshot(offline_bnk_dir))?
        .ok_or_else(|| http_error(422, fl!("snapshot-not-found")))?;

    let data = std::fs::read(&snapshot)?;
    let js =
        util::extract_utf16le_between(&data, "var __webpack_modules__={", "xpui-modules.js.map")
            .ok_or_else(|| {
                wrap_error(
                    anyhow::anyhow!(
                        "could not locate xpui-modules.js.map markers in v8 snapshot at {}",
                        snapshot.display()
                    ),
                    500,
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
    let idx = input.find(target).ok_or_else(|| http_error(422, fl!("index-patch-not-found")))?;
    Ok(format!("{}{}{}", &input[..idx], replacement, &input[idx + target.len()..]))
}
