use std::path::Path;

use anyhow::{Context, Result, anyhow};

use crate::{config::AppContext, logging, util};

pub fn run(ctx: &AppContext) -> Result<()> {
    let apps = ctx.spotify_apps_path();
    let dest_apps = if ctx.mirror {
        ctx.config_root.join("apps")
    } else {
        apps.clone()
    };

    let spa = apps.join("xpui.spa");
    if !spa.exists() && dest_apps.join("xpui").exists() {
        return Err(anyhow!("Spicetify appears to be already applied"));
    }

    std::fs::create_dir_all(&dest_apps)?;

    logging::info(&format!(
        "Extracting {} -> {}",
        spa.display(),
        dest_apps.join("xpui").display()
    ));
    extract_spa(&spa, &dest_apps, ctx.mirror)?;

    let dest_xpui = dest_apps.join("xpui");
    logging::info("Extracting xpui-modules from V8 snapshot binary...");
    if let Err(err) = extract_modules(&ctx.spotify_data_path, &dest_xpui) {
        logging::error(&format!("Failed to extract modules: {err}"));
        return Err(err);
    }

    logging::info("Patching xpui/index.html to redirect to modules");
    patch_index(&dest_xpui)?;

    link_runtime_dirs(&ctx.config_root, &dest_xpui)?;
    Ok(())
}

fn extract_spa(spa: &Path, dest: &Path, mirror: bool) -> Result<()> {
    if !spa.exists() {
        if dest.join("xpui").exists() {
            return Err(anyhow!("Spicetify appears to be already applied"));
        }
        return Err(anyhow!(
            "could not find Spotify's xpui.spa at {}. Set --spotify-data-path \
             (or spotify-data-path in config.yaml) to your Spotify install folder; \
             for Microsoft Store installs also enable mirror mode",
            spa.display()
        ));
    }

    let name = spa
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| anyhow!("invalid spa filename"))?
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
        .ok_or_else(|| anyhow!("v8_context_snapshot*.bin not found"))?;

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
        logging::info(&format!("Linking {} -> {}", dst.display(), src.display()));
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
    let idx = input.find(target).context("index patch target not found")?;
    Ok(format!(
        "{}{}{}",
        &input[..idx],
        replacement,
        &input[idx + target.len()..]
    ))
}
