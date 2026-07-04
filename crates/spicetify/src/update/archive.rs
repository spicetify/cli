use std::path::Path;

use reqwest::blocking::{Client, Response};

use crate::error::Result;
use crate::update::{ReleaseInfo, USER_AGENT, UpdateError};
use crate::util;

const DOWNLOAD_TIMEOUT_SECS: u64 = 120;

pub fn download_and_extract(release: &ReleaseInfo, staging_dir: &Path) -> Result<()> {
    let asset = release.find_platform_asset().ok_or_else(|| {
        let names = candidate_asset_names(&release.version());
        UpdateError::NoAsset(names.join(", "))
    })?;

    let archive_path = staging_dir.join(&asset.name);
    if !archive_path.exists() {
        download_asset(&asset.browser_download_url, &archive_path)?;
    }
    extract_archive(&archive_path, staging_dir).inspect_err(|_| {
        if let Err(e) = std::fs::remove_dir_all(staging_dir)
            && e.kind() != std::io::ErrorKind::NotFound
        {
            tracing::warn!(error = %e, path = %staging_dir.display(), "failed to remove directory");
        }
    })?;
    verify_staged_binary(staging_dir)?;

    Ok(())
}

fn download_asset(url: &str, dest: &Path) -> Result<()> {
    let client = Client::builder()
        .user_agent(USER_AGENT)
        .timeout(std::time::Duration::from_secs(DOWNLOAD_TIMEOUT_SECS))
        .build()
        .map_err(|e| UpdateError::Network(e.to_string()))?;

    let mut response = client
        .get(url)
        .send()
        .and_then(Response::error_for_status)
        .map_err(|e| UpdateError::Network(e.to_string()))?;

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut file = std::fs::File::create(dest)?;
    let _ = response.copy_to(&mut file).map_err(|e| UpdateError::Network(e.to_string()))?;

    Ok(())
}

fn extract_archive(archive_path: &Path, staging_dir: &Path) -> Result<()> {
    let ext = archive_path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let name = archive_path.to_string_lossy();

    if ext == "zip" {
        util::unzip_file(archive_path, staging_dir)
            .map_err(|e| UpdateError::Parse(format!("{e}")))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let binary = staging_dir.join(binary_name());
            if let Err(e) =
                std::fs::set_permissions(&binary, std::fs::Permissions::from_mode(0o755))
            {
                tracing::warn!(error = %e, "staged zip binary not executable");
            }
        }
        Ok(())
    } else if name.ends_with(".tar.zst") {
        let bytes = std::fs::read(archive_path)?;
        util::untar_zst_bytes(&bytes, staging_dir)
            .map_err(|e| UpdateError::Parse(format!("{e}")))?;
        Ok(())
    } else {
        Err(UpdateError::Parse(format!("unsupported archive format: {name}")).into())
    }
}

fn verify_staged_binary(staging_dir: &Path) -> Result<()> {
    let binary = staging_dir.join(binary_name());
    if !binary.exists() {
        return Err(
            UpdateError::Parse(format!("staged binary not found at {}", binary.display())).into()
        );
    }

    let output = std::process::Command::new(&binary)
        .arg("--version")
        .output()
        .map_err(|e| UpdateError::Parse(format!("failed to run staged --version: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(
            UpdateError::Parse(format!("staged binary failed --version check: {stderr}")).into()
        );
    }

    Ok(())
}

pub fn binary_name() -> &'static str {
    if cfg!(windows) { "spicetify.exe" } else { "spicetify" }
}

pub fn candidate_asset_names(version: &str) -> Vec<String> {
    let arch = std::env::consts::ARCH;
    let os = std::env::consts::OS;
    let ext = if cfg!(windows) { "zip" } else { "tar.zst" };
    let mut names = Vec::new();

    names.push(format!("spicetify-{version}-{arch}-{os}.{ext}"));

    if os == "macos" {
        names.push(format!("spicetify-{version}-{os}.{ext}"));
    }

    let short_arch = short_arch_name(arch);
    if short_arch != arch {
        names.push(format!("spicetify-{version}-{short_arch}-{os}.{ext}"));
    }

    names.push(format!("portable-spicetify-{version}-{short_arch}.{ext}"));

    names
}

fn short_arch_name(arch: &str) -> &str {
    match arch {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        _ => arch,
    }
}
