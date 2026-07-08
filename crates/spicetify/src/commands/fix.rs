use std::path::{Path, PathBuf};

use crate::context::AppContext;
use crate::error::Result;
use crate::fl;

pub(crate) fn run(ctx: &AppContext) -> Result<()> {
    if ctx.mirror {
        let mirror_apps = ctx.config_root.join("apps");
        if let Err(e) = std::fs::remove_dir_all(&mirror_apps)
            && e.kind() != std::io::ErrorKind::NotFound
        {
            tracing::warn!(
                path = %mirror_apps.display(),
                error = %e,
                "{}",
                fl!("failed-remove-mirrored-apps", path = mirror_apps.to_string_lossy(), err = e.to_string())
            );
        }
        return Ok(());
    }

    let apps = ctx.spotify_apps_path();
    let mut found = 0usize;

    for entry in std::fs::read_dir(&apps)? {
        let entry = entry?;
        let path = entry.path();
        let name = path.file_name().and_then(|s| s.to_str()).unwrap_or_default();
        if !name.ends_with(".spa.backup") {
            continue;
        }
        found += 1;
        let spa = restore_target(&path);
        let unpacked = unpacked_folder(&spa);

        if let Err(e) = std::fs::remove_dir_all(&unpacked)
            && e.kind() != std::io::ErrorKind::NotFound
        {
            tracing::warn!(error = %e, path = %unpacked.display(), "failed to remove directory");
        }

        if let Err(e) = std::fs::rename(&path, &spa) {
            tracing::error!(
                path = %path.display(),
                error = %e,
                "{}",
                fl!("failed-restore-backup", path = path.to_string_lossy(), err = e.to_string())
            );
            return Err(anyhow::anyhow!("failed to restore {}: {e}", path.display()));
        }
    }

    if found == 0 {
        return Err(anyhow::anyhow!(fl!("already-stock")));
    }

    tracing::info!("{}", fl!("restored-stock"));
    Ok(())
}

fn restore_target(backup: &Path) -> PathBuf {
    let name = backup.file_name().and_then(|s| s.to_str()).unwrap_or_default();
    name.strip_suffix(".backup")
        .map_or_else(|| backup.to_path_buf(), |stripped| backup.with_file_name(stripped))
}

fn unpacked_folder(spa: &Path) -> PathBuf {
    let name = spa.file_name().and_then(|s| s.to_str()).unwrap_or_default();
    name.strip_suffix(".spa")
        .map_or_else(|| spa.to_path_buf(), |stripped| spa.with_file_name(stripped))
}
