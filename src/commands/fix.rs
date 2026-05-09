use std::{io::ErrorKind, path::Path};

use anyhow::{Result, bail};

use crate::{config::AppContext, logging};

pub fn run(ctx: &AppContext) -> Result<()> {
    if ctx.mirror {
        let mirror_apps = ctx.config_root.join("apps");
        if let Err(err) = std::fs::remove_dir_all(&mirror_apps) {
            logging::warn(&format!(
                "failed to remove mirrored apps folder {}: {}",
                mirror_apps.display(),
                err
            ));
        }
        return Ok(());
    }

    let apps = ctx.spotify_apps_path();
    let mut found = 0usize;

    for entry in std::fs::read_dir(&apps)? {
        let entry = entry?;
        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or_default();
        if !name.ends_with(".spa.backup") {
            continue;
        }
        found += 1;
        let spa = restore_target(&path);
        let unpacked = unpacked_folder(&spa);
        if let Err(err) = std::fs::remove_dir_all(&unpacked) {
            if err.kind() != ErrorKind::NotFound {
                logging::warn(&format!(
                    "failed to remove unpacked folder {}: {}",
                    unpacked.display(),
                    err
                ));
            }
        }
        if let Err(err) = std::fs::rename(&path, &spa) {
            logging::error(&format!("failed to restore {}: {}", path.display(), err));
        }
    }

    if found == 0 {
        bail!("Spotify is already in stock state!");
    }
    Ok(())
}

fn restore_target(backup: &Path) -> std::path::PathBuf {
    let s = backup.to_string_lossy();
    if let Some(stripped) = s.strip_suffix(".backup") {
        std::path::PathBuf::from(stripped)
    } else {
        backup.to_path_buf()
    }
}

fn unpacked_folder(spa: &Path) -> std::path::PathBuf {
    let s = spa.to_string_lossy();
    if let Some(stripped) = s.strip_suffix(".spa") {
        std::path::PathBuf::from(stripped)
    } else {
        spa.to_path_buf()
    }
}
