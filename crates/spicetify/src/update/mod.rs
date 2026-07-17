pub mod archive;
pub mod release;

use std::path::Path;
use std::time::Duration;

use anyhow::Context;
pub use release::{InstallAsset, ReleaseInfo};
use reqwest::blocking::Response;
use semver::Version;
use thiserror::Error;

use crate::error::Result;

const RELEASES_URL: &str = "https://api.github.com/repos/veryboringhwl/app/releases/latest";

#[derive(Debug, Error)]
pub enum UpdateError {
    #[error("network error: {0}")]
    Network(String),

    #[error("failed to parse: {0}")]
    Parse(String),

    #[error("no release asset found for: {0}")]
    NoAsset(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

pub fn check_for_update() -> Result<Option<ReleaseInfo>> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| UpdateError::Network(e.to_string()))?;

    let response = client
        .get(RELEASES_URL)
        .send()
        .and_then(Response::error_for_status)
        .map_err(|e| UpdateError::Network(e.to_string()))?;

    let release: ReleaseInfo = response.json().map_err(|e| UpdateError::Parse(e.to_string()))?;

    let current = Version::parse(crate::VERSION).map_err(|e| UpdateError::Parse(e.to_string()))?;
    let latest =
        Version::parse(&release.version()).map_err(|e| UpdateError::Parse(e.to_string()))?;

    if latest > current { Ok(Some(release)) } else { Ok(None) }
}

pub fn download_and_install(release: &ReleaseInfo) -> Result<()> {
    let version = release.version();
    let staging_dir = std::env::temp_dir().join(format!("spicetify-update-{version}"));

    if staging_dir.exists() {
        std::fs::remove_dir_all(&staging_dir)?;
    }
    std::fs::create_dir_all(&staging_dir)?;

    archive::download_and_extract(release, &staging_dir)?;
    install_from_staging(&staging_dir, &version)
}

fn install_from_staging(staging_dir: &Path, version: &str) -> Result<()> {
    let installed_path = std::env::current_exe()?;
    let new_binary = staging_dir.join(archive::binary_name());
    let backup_path = installed_path.with_extension("old");

    tracing::info!("installing update to version {version}");

    if let Err(e) = std::fs::remove_file(&backup_path)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(error = %e, path = %backup_path.display(), "failed to remove file");
    }
    std::fs::rename(&installed_path, &backup_path)
        .with_context(|| format!("failed to backup {}", installed_path.display()))?;

    if let Err(e) = std::fs::copy(&new_binary, &installed_path) {
        if let Err(rollback_err) = std::fs::rename(&backup_path, &installed_path) {
            tracing::error!(
                error = %rollback_err,
                "critical: rollback of old binary failed after copy error"
            );
        }
        return Err(e).context("failed to copy new binary into place");
    }

    if let Err(e) = std::fs::remove_file(&backup_path)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(error = %e, path = %backup_path.display(), "failed to remove file");
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Err(e) =
            std::fs::set_permissions(&installed_path, std::fs::Permissions::from_mode(0o755))
        {
            tracing::warn!(error = %e, "failed to set executable permission on updated binary");
        }
    }

    replace_daemon_binary(staging_dir, &installed_path);

    if let Err(e) = std::fs::remove_dir_all(staging_dir)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(error = %e, path = %staging_dir.display(), "failed to remove directory");
    }

    tracing::info!("restarting with version {version}");
    let args: Vec<String> = std::env::args().skip(1).collect();
    std::process::Command::new(&installed_path)
        .args(&args)
        .spawn()
        .map(|_| ())
        .context("failed to spawn updated binary")?;

    std::thread::sleep(Duration::from_millis(500));
    Ok(())
}

fn replace_daemon_binary(staging_dir: &Path, installed_main: &Path) {
    let Some(daemon_installed) =
        installed_main.parent().map(|d| d.join(crate::daemon::daemon_binary_name()))
    else {
        return;
    };

    let daemon_staging = staging_dir.join(crate::daemon::daemon_binary_name());
    if !daemon_staging.exists() {
        return;
    }

    let daemon_backup = daemon_installed.with_extension("old");
    if let Err(e) = std::fs::remove_file(&daemon_backup)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(error = %e, path = %daemon_backup.display(), "failed to remove file");
    }

    if let Err(e) = std::fs::rename(&daemon_installed, &daemon_backup) {
        tracing::warn!(error = %e, "failed to backup daemon binary");
        return;
    }

    if let Err(e) = std::fs::copy(&daemon_staging, &daemon_installed) {
        if let Err(rollback_err) = std::fs::rename(&daemon_backup, &daemon_installed) {
            tracing::warn!(error = %rollback_err, "failed to rollback daemon binary");
        }
        tracing::warn!(error = %e, "failed to update daemon binary");
        return;
    }

    if let Err(e) = std::fs::remove_file(&daemon_backup)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(error = %e, path = %daemon_backup.display(), "failed to remove file");
    }
}
