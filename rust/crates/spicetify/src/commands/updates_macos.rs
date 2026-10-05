use std::os::macos::fs::MetadataExt;
use std::path::{Path, PathBuf};

use super::{ENDPOINT_BLOCKED, ENDPOINT_LIVE, contains, patch_update_endpoint, spotify_binary};
use crate::context::AppContext;
use crate::error::Result;

// Darwin's UF_IMMUTABLE bit, set by chflags uchg.
const USER_IMMUTABLE: u32 = 0x0000_0002;

fn staging_dirs(ctx: &AppContext) -> Result<[PathBuf; 2]> {
    let persistent = &ctx.offline_bnk_dir;
    anyhow::ensure!(
        persistent.is_absolute()
            && persistent.file_name().is_some_and(|name| name == "PersistentCache"),
        "cannot locate Spotify update staging from {}; expected an absolute PersistentCache directory",
        persistent.display()
    );
    let parent =
        persistent.parent().ok_or_else(|| anyhow::anyhow!("missing Spotify cache root"))?;
    anyhow::ensure!(parent.parent().is_some(), "refusing to protect Update at the filesystem root");
    let dirs = [parent.join("Update"), persistent.join("Update")];
    for path in &dirs {
        validate_directory_path(path)?;
    }
    Ok(dirs)
}

fn validate_directory_path(path: &Path) -> Result<()> {
    for ancestor in path.ancestors() {
        match std::fs::symlink_metadata(ancestor) {
            Ok(metadata) => anyhow::ensure!(
                metadata.is_dir() && !metadata.is_symlink(),
                "Spotify update staging must not traverse a symlink or non-directory: {}",
                ancestor.display()
            ),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                anyhow::bail!(
                    "cannot inspect Spotify update staging {}: {error}",
                    ancestor.display()
                );
            }
        }
    }
    Ok(())
}

fn immutable(path: &Path) -> Result<bool> {
    match std::fs::symlink_metadata(path) {
        Ok(metadata) => {
            anyhow::ensure!(metadata.is_dir(), "not a staging directory: {}", path.display());
            Ok(metadata.st_flags() & USER_IMMUTABLE != 0)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => {
            Err(anyhow::anyhow!("cannot inspect update protection {}: {error}", path.display()))
        }
    }
}

fn protection(dirs: &[PathBuf; 2]) -> Result<[bool; 2]> {
    Ok([immutable(&dirs[0])?, immutable(&dirs[1])?])
}

fn legacy_binary(ctx: &AppContext) -> Result<Option<Vec<u8>>> {
    let binary = spotify_binary(ctx);
    match std::fs::read(&binary) {
        Ok(raw) => Ok(Some(raw)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => {
            Err(anyhow::anyhow!("cannot inspect legacy update block {}: {error}", binary.display()))
        }
    }
}

pub(super) fn is_blocked(ctx: &AppContext) -> Result<bool> {
    let dirs = staging_dirs(ctx)?;
    if has_staged_update(&dirs[0])? || has_staged_update(&dirs[1])? {
        return Ok(false);
    }
    if protection(&dirs)?.into_iter().all(|blocked| blocked) {
        return Ok(true);
    }
    Ok(legacy_binary(ctx)?.is_some_and(|raw| {
        contains(&raw, ENDPOINT_BLOCKED.as_bytes()) && !contains(&raw, ENDPOINT_LIVE.as_bytes())
    }))
}

pub(super) fn has_existing_block(ctx: &AppContext) -> Result<bool> {
    let dirs = staging_dirs(ctx)?;
    if protection(&dirs)?.into_iter().any(|blocked| blocked) {
        return Ok(true);
    }
    Ok(legacy_binary(ctx)?.is_some_and(|raw| contains(&raw, ENDPOINT_BLOCKED.as_bytes())))
}

fn set_flag(path: &Path, block: bool) -> Result<()> {
    let output = std::process::Command::new("/usr/bin/chflags")
        .arg(if block { "uchg" } else { "nouchg" })
        .arg(path)
        .output()
        .map_err(|error| {
            anyhow::anyhow!("cannot change update protection {}: {error}", path.display())
        })?;
    anyhow::ensure!(
        output.status.success(),
        "cannot {} Spotify update staging {}: {}",
        if block { "protect" } else { "unprotect" },
        path.display(),
        String::from_utf8_lossy(&output.stderr).trim()
    );
    anyhow::ensure!(
        immutable(path)? == block,
        "could not verify update protection {}",
        path.display()
    );
    Ok(())
}

fn has_staged_update(path: &Path) -> Result<bool> {
    match std::fs::read_dir(path) {
        Ok(mut entries) => Ok(entries.next().transpose()?.is_some()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => {
            Err(anyhow::anyhow!("cannot inspect staged updates {}: {error}", path.display()))
        }
    }
}

fn clear_staging_directory(path: &Path) -> Result<()> {
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let child = entry.path();
        if entry.file_type()?.is_dir() {
            std::fs::remove_dir_all(&child)?;
        } else {
            std::fs::remove_file(&child)?;
        }
    }
    Ok(())
}

fn set_directory_block(dirs: &[PathBuf; 2], block: bool) -> Result<()> {
    for path in dirs {
        if block {
            std::fs::create_dir_all(path).map_err(|error| {
                anyhow::anyhow!("cannot create update staging {}: {error}", path.display())
            })?;
            if has_staged_update(path)? {
                set_flag(path, false)?;
                clear_staging_directory(path)?;
            }
            if !immutable(path)? {
                set_flag(path, true)?;
            }
        } else if immutable(path)? {
            set_flag(path, false)?;
        }
    }
    anyhow::ensure!(
        protection(dirs)?.into_iter().all(|protected| protected == block),
        "could not verify Spotify update staging protection"
    );
    Ok(())
}

fn migration_backup(binary: &Path) -> Result<PathBuf> {
    let bundle = super::spotify_bundle_for_binary(binary)?;
    let parent = bundle.parent().ok_or_else(|| anyhow::anyhow!("missing bundle parent"))?;
    let mut name = std::ffi::OsString::from(".spicetify-legacy-");
    name.push(bundle.file_name().ok_or_else(|| anyhow::anyhow!("missing bundle name"))?);
    name.push("-");
    name.push(binary.file_name().ok_or_else(|| anyhow::anyhow!("missing executable name"))?);
    name.push(".backup");
    Ok(parent.join(name))
}

fn pending_migration(binary: &Path) -> Result<Option<Vec<u8>>> {
    let Ok(backup) = migration_backup(binary) else { return Ok(None) };
    match std::fs::symlink_metadata(&backup) {
        Ok(metadata) => {
            anyhow::ensure!(
                metadata.is_file(),
                "invalid legacy migration backup: {}",
                backup.display()
            );
            let original = std::fs::read(&backup)?;
            anyhow::ensure!(
                contains(&original, ENDPOINT_BLOCKED.as_bytes()),
                "legacy migration backup has no blocked endpoint: {}",
                backup.display()
            );
            Ok(Some(original))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

fn atomic_replace_binary(
    binary: &Path,
    bytes: &[u8],
    write: impl FnOnce(&mut std::fs::File, &[u8]) -> std::io::Result<()>,
) -> Result<()> {
    let nonce = super::SystemTime::now().duration_since(super::UNIX_EPOCH)?.as_nanos();
    let backup = migration_backup(binary)?;
    let staged = backup.with_extension(format!("tmp-{}-{nonce}", std::process::id()));
    let mut file = std::fs::OpenOptions::new().create_new(true).write(true).open(&staged)?;
    let result = (|| -> Result<()> {
        let _ = std::fs::copy(&backup, &staged)?;
        file.set_len(0)?;
        write(&mut file, bytes)?;
        file.sync_all()?;
        std::fs::rename(&staged, binary)?;
        Ok(())
    })();
    if result.is_err() {
        std::fs::remove_file(&staged).map_err(|cleanup| {
            anyhow::anyhow!(
                "legacy migration staging failed ({result:?}); could not remove {}: {cleanup}",
                staged.display()
            )
        })?;
    }
    result
}

fn restore_legacy_endpoint(ctx: &AppContext, original: Option<&[u8]>) -> Result<()> {
    let Some(original) = original else { return Ok(()) };
    let mut restored = original.to_vec();
    if !patch_update_endpoint(&mut restored, false) {
        return Ok(());
    }
    let binary = spotify_binary(ctx);
    let backup = migration_backup(&binary)?;
    if pending_migration(&binary)?.is_none() {
        anyhow::ensure!(
            std::fs::symlink_metadata(&binary)?.is_file(),
            "legacy executable must be a regular file: {}",
            binary.display()
        );
        std::fs::hard_link(&binary, &backup)?;
    }
    // Keep the original inode outside the bundle until signing completes;
    // interrupted migrations are retried from this backup on the next policy change.
    atomic_replace_binary(&binary, &restored, std::io::Write::write_all)?;
    if let Err(signing) = super::codesign_bundle(&binary) {
        std::fs::rename(&backup, &binary).map_err(|rollback| {
            anyhow::anyhow!("legacy endpoint restoration failed to sign ({signing}) and failed to restore {} from {}: {rollback}", binary.display(), backup.display())
        })?;
        anyhow::bail!(
            "could not re-sign the restored legacy update endpoint; restored the original binary: {signing}"
        );
    }
    std::fs::remove_file(&backup)?;
    Ok(())
}

pub(super) fn set_blocked(ctx: &AppContext, block: bool) -> Result<()> {
    let dirs = staging_dirs(ctx)?;
    let protected = protection(&dirs)?;
    let original = match pending_migration(&spotify_binary(ctx))? {
        Some(original) => Some(original),
        None => legacy_binary(ctx)?.filter(|raw| contains(raw, ENDPOINT_BLOCKED.as_bytes())),
    };
    let legacy_patch = original.is_some();
    let staged = block && (has_staged_update(&dirs[0])? || has_staged_update(&dirs[1])?);
    if !legacy_patch && !staged && protected.into_iter().all(|state| state == block) {
        tracing::info!("Spotify updates already {}", if block { "blocked" } else { "allowed" });
        return Ok(());
    }

    crate::lifecycle::stop(ctx)?;
    if block {
        set_directory_block(&dirs, true)?;
        restore_legacy_endpoint(ctx, original.as_deref())?;
    } else {
        restore_legacy_endpoint(ctx, original.as_deref())?;
        set_directory_block(&dirs, false)?;
    }
    tracing::info!("{} Spotify updates", if block { "Disabled" } else { "Enabled" });
    Ok(())
}

#[cfg(test)]
#[path = "updates_macos_tests.rs"]
mod tests;

pub(super) fn preflight_mutation(ctx: &AppContext) -> Result<()> {
    let dirs = staging_dirs(ctx)?;
    for path in dirs {
        let parent = path.parent().ok_or_else(|| anyhow::anyhow!("missing staging parent"))?;
        std::fs::create_dir_all(parent)?;
        let nonce = super::SystemTime::now().duration_since(super::UNIX_EPOCH)?.as_nanos();
        let probe =
            parent.join(format!(".spicetify-update-preflight-{}-{nonce}", std::process::id()));
        std::fs::create_dir(&probe)?;
        let locked = set_flag(&probe, true);
        let cleanup =
            set_flag(&probe, false).and_then(|()| std::fs::remove_dir(&probe).map_err(Into::into));
        if let Err(error) = cleanup {
            anyhow::bail!(
                "update protection probe result {locked:?}; could not clean up {}: {error}",
                probe.display()
            );
        }
        locked?;
    }
    Ok(())
}
