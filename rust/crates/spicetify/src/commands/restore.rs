use std::path::{Path, PathBuf};

use crate::context::AppContext;
use crate::error::Result;
use crate::fl;

pub(crate) fn run(ctx: &AppContext) -> Result<()> {
    if ctx.mirror {
        return restore_mirror(ctx);
    }

    if !has_spa_backups(ctx)? {
        // No backup of ours, but a patched client on disk means another tool
        // owns this apply and only that tool can undo it. Saying "already
        // stock" would send the user away from the only working recovery.
        if !ctx.mirror
            && ctx.dest_apps_path().join("xpui").is_dir()
            && !ctx.spotify_apps_path().join("xpui.spa").is_file()
        {
            return Err(anyhow::anyhow!(fl!("foreign-apply")));
        }
        return Err(anyhow::anyhow!(fl!("already-stock")));
    }

    stop_for_restore(ctx)?;

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

    crate::lifecycle::start(ctx)?;

    tracing::info!("{}", fl!("restored-stock"));
    Ok(())
}

// Mirror mode never renames the original `.spa`, so it leaves no backup to key
// off: the mirrored tree in the config root is the only artifact.
fn restore_mirror(ctx: &AppContext) -> Result<()> {
    let mirror_apps = ctx.config_root.join("apps");
    if !mirror_apps.exists() {
        return Err(anyhow::anyhow!(fl!("already-stock")));
    }

    stop_for_restore(ctx)?;

    if let Err(e) = std::fs::remove_dir_all(&mirror_apps)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        return Err(anyhow::anyhow!(fl!(
            "failed-remove-mirrored-apps",
            path = mirror_apps.to_string_lossy(),
            err = e.to_string()
        )));
    }

    crate::lifecycle::start(ctx)?;
    tracing::info!("{}", fl!("restored-stock"));
    Ok(())
}

fn stop_for_restore(ctx: &AppContext) -> Result<()> {
    crate::daemon::shutdown_daemon();

    if let Err(e) = super::daemon::uninstall() {
        tracing::warn!(error = %e, "failed to uninstall daemon auto-start");
    }

    crate::lifecycle::stop(ctx)
}

fn has_spa_backups(ctx: &AppContext) -> Result<bool> {
    let apps = ctx.spotify_apps_path();
    let dir = match std::fs::read_dir(&apps) {
        Ok(d) => d,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(e) => return Err(e.into()),
    };
    for entry in dir {
        let entry = entry?;
        if entry.file_name().to_str().is_some_and(|n| n.ends_with(".spa.backup")) {
            return Ok(true);
        }
    }
    Ok(false)
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
