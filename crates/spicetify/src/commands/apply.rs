use std::path::Path;

use anyhow::{Context, Result, anyhow};

use crate::{config::AppContext, i18n, logging, util};

pub fn run(ctx: &AppContext) -> Result<()> {
    let apps = ctx.spotify_apps_path();
    let dest_apps = if ctx.mirror {
        ctx.config_root.join("apps")
    } else {
        apps.clone()
    };

    let spa = apps.join("xpui.spa");
    if !spa.exists() && dest_apps.join("xpui").exists() {
        return Err(anyhow!(i18n::lookup("already_applied")));
    }

    std::fs::create_dir_all(&dest_apps)?;

    logging::info(i18n::lookup_with_args(
        "extracting_spa",
        &[
            ("src", &spa.display().to_string()),
            ("dest", &dest_apps.join("xpui").display().to_string()),
        ],
    ));
    extract_spa(&spa, &dest_apps, ctx.mirror)?;

    let dest_xpui = dest_apps.join("xpui");
    logging::info(i18n::lookup("extracting_modules"));
    if let Err(err) = extract_modules(&ctx.spotify_data_path, &dest_xpui) {
        logging::error(i18n::lookup_with_args(
            "failed_extract_modules",
            &[("err", &err.to_string())],
        ));
        return Err(err);
    }

    logging::info(i18n::lookup("patching_index"));
    patch_index(&dest_xpui)?;

    link_runtime_dirs(&ctx.config_root, &dest_xpui)?;
    Ok(())
}

fn extract_spa(spa: &Path, dest: &Path, mirror: bool) -> Result<()> {
    if !spa.exists() {
        if dest.join("xpui").exists() {
            return Err(anyhow!(i18n::lookup("already_applied")));
        }
        return Err(anyhow!(i18n::lookup_with_args(
            "xpui_not_found",
            &[("path", &spa.display().to_string())]
        )));
    }

    let name = spa
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| anyhow!(i18n::lookup("invalid_spa_filename")))?
        .trim_end_matches(".spa");
    let extract_to = dest.join(name);

    util::unzip_file(spa, &extract_to)?;

    if !mirror {
        let backup = spa.with_extension("spa.backup");
        let _ = std::fs::remove_file(&backup);
        std::fs::rename(spa, &backup)?;
    }
    Ok(())
}

fn extract_modules(spotify_data: &Path, dest: &Path) -> Result<()> {
    let snapshot = std::fs::read_dir(spotify_data)?
        .filter_map(|e| e.ok())
        .find(|e| {
            e.file_name()
                .to_str()
                .map(|n| n.starts_with("v8_context_snapshot") && n.ends_with(".bin"))
                .unwrap_or(false)
        })
        .ok_or_else(|| anyhow!(i18n::lookup("snapshot_not_found")))?;

    let data = std::fs::read(snapshot.path())?;
    let js =
        util::extract_utf16le_between(&data, "var __webpack_modules__={", "xpui-modules.js.map")?;
    std::fs::write(dest.join("xpui-modules.js"), &js)?;
    Ok(())
}

fn patch_index(dest: &Path) -> Result<()> {
    let index = dest.join("index.html");
    let raw = std::fs::read_to_string(&index)?;
    let patched = patch_index_html(&raw)?;
    std::fs::write(&index, &patched)?;
    Ok(())
}

fn link_runtime_dirs(config_root: &Path, dest: &Path) -> Result<()> {
    for folder in ["hooks", "modules", "store"] {
        let src = config_root.join(folder);
        let dst = dest.join(folder);
        logging::info(i18n::lookup_with_args(
            "linking_dir",
            &[
                ("dst", &dst.display().to_string()),
                ("src", &src.display().to_string()),
            ],
        ));
        if !src.exists() {
            std::fs::create_dir_all(&src)?;
        }
        util::create_dir_link(&src, &dst)?;
    }
    Ok(())
}

fn patch_index_html(input: &str) -> Result<String> {
    let target = "<script defer=\"defer\" src=\"/xpui-snapshot.js\"></script>";
    let replacement = "<script type=\"module\" src=\"./hooks/index.js\"></script>";
    let idx = input
        .find(target)
        .context(i18n::lookup("index_patch_not_found"))?;
    Ok(format!(
        "{}{}{}",
        &input[..idx],
        replacement,
        &input[idx + target.len()..]
    ))
}
