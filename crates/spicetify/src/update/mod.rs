pub mod release;

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use anyhow::Context;
pub use release::{ChecksumError, ReleaseInfo};
use semver::Version;
use tokio::io::AsyncWriteExt;
use tokio_stream::StreamExt;

use crate::error::Result;

const GITHUB_API: &str = "https://api.github.com/repos/veryboringhwl/app/releases/latest";

fn http_client() -> Result<reqwest::Client> {
    let mut headers = reqwest::header::HeaderMap::new();
    let ua = format!("spicetify/{}", crate::VERSION);
    let _ = headers.insert(
        reqwest::header::USER_AGENT,
        reqwest::header::HeaderValue::from_str(&ua).expect("valid user agent"),
    );
    let _ = headers.insert(
        reqwest::header::ACCEPT,
        reqwest::header::HeaderValue::from_static("application/vnd.github.v3+json"),
    );

    let mut builder =
        reqwest::Client::builder().default_headers(headers).timeout(Duration::from_secs(15));

    if let Ok(token) = std::env::var("GITHUB_TOKEN")
        && let Ok(val) = reqwest::header::HeaderValue::from_str(&format!("Bearer {token}"))
    {
        let mut h = reqwest::header::HeaderMap::new();
        let _ = h.insert(reqwest::header::AUTHORIZATION, val);
        builder = builder.default_headers(h);
    }

    builder.build().map_err(Into::into)
}

pub async fn check_for_update() -> Result<Option<ReleaseInfo>> {
    let client = http_client()?;
    let response = client
        .get(GITHUB_API)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .context("failed to fetch latest release")?;

    let release: ReleaseInfo = response.json().await.context("failed to parse release JSON")?;
    let current = Version::parse(crate::VERSION).context("invalid current version")?;
    let latest = Version::parse(&release.version()).context("invalid latest release version")?;

    if latest > current { Ok(Some(release)) } else { Ok(None) }
}

#[derive(Debug)]
pub struct StagedUpdate {
    pub version: String,
    new_binary: PathBuf,
    daemon_binary: Option<PathBuf>,
    staging_dir: PathBuf,
}

pub async fn download_update(
    release: &ReleaseInfo,
    on_progress: impl Fn(u64, u64) + Send + 'static,
) -> Result<StagedUpdate> {
    let asset = release.find_platform_asset().ok_or_else(|| {
        let names = release::candidate_asset_names(&release.version());
        anyhow::anyhow!("no release asset found for platform; tried: {}", names.join(", "))
    })?;

    let version = release.version();
    let install_dir = install_dir()?;
    let staging_dir = install_dir.join(".updates").join(&version);

    if staging_dir.exists() {
        std::fs::remove_dir_all(&staging_dir).context("failed to clean staging dir")?;
    }
    std::fs::create_dir_all(&staging_dir).context("failed to create staging dir")?;

    let archive_path = staging_dir.join(&asset.name);
    download_with_progress(&asset.browser_download_url, &archive_path, &on_progress).await?;

    if let Some(checksum_asset) = release.find_checksum_asset(&asset.name) {
        if let Err(e) = fetch_and_verify_checksum(checksum_asset, &archive_path).await {
            tracing::warn!(error = %e, "checksum verification failed, continuing anyway");
        }
    } else {
        let computed = release::compute_sha256(&archive_path).unwrap_or_default();
        tracing::info!(sha256 = %computed, path = %archive_path.display(), "no checksum asset in release; computed sha256");
    }

    extract_archive(&archive_path, &staging_dir)?;

    let new_binary = staging_dir.join(release::binary_name());
    verify_staged_binary(&new_binary)?;

    let daemon_binary = {
        let daemon_name = crate::daemon::daemon_binary_name();
        let p = staging_dir.join(daemon_name);
        if p.exists() { Some(p) } else { None }
    };

    Ok(StagedUpdate { version, new_binary, daemon_binary, staging_dir })
}

pub fn install_update(staged: &StagedUpdate) -> Result<()> {
    let current_exe = std::env::current_exe()?;
    let install_dir = current_exe.parent().context("exe has no parent dir")?;

    if let Some(daemon) = &staged.daemon_binary {
        let daemon_path = install_dir.join(crate::daemon::daemon_binary_name());
        if daemon_path.exists() {
            crate::daemon::shutdown_daemon();
            std::thread::sleep(Duration::from_millis(300));
            replace_binary(daemon, &daemon_path).context("failed to replace daemon binary")?;
        }
    }

    replace_binary(&staged.new_binary, &current_exe).context("failed to replace main binary")?;

    if let Err(e) = std::fs::remove_dir_all(&staged.staging_dir) {
        tracing::warn!(error = %e, "failed to remove staging dir");
    }

    tracing::info!(version = %staged.version, "spawning updated binary");
    let args: Vec<String> = std::env::args().skip(1).collect();
    let child = std::process::Command::new(&current_exe)
        .args(&args)
        .spawn()
        .context("failed to spawn updated binary")?;

    std::thread::sleep(Duration::from_millis(200));

    tracing::info!(pid = child.id(), "spawned updated process, exiting");
    std::process::exit(0);
}

pub fn startup_cleanup() {
    let Ok(install_dir) = install_dir() else { return };

    cleanup_old_files(&install_dir);
    cleanup_staging_dirs(&install_dir);
}

fn install_dir() -> Result<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(Path::to_path_buf))
        .context("cannot determine install directory")
}

fn replace_binary(new: &Path, target: &Path) -> Result<()> {
    let backup = target.with_extension("old");

    if let Err(e) = std::fs::remove_file(&backup) {
        tracing::warn!(error = %e, "failed to remove old backup");
    }

    if cfg!(windows) {
        std::fs::rename(target, &backup).with_context(|| {
            format!(
                "failed to rename {} to {}; close other processes holding a lock",
                target.display(),
                backup.display()
            )
        })?;
    } else {
        std::fs::remove_file(target)
            .with_context(|| format!("failed to remove {}", target.display()))?;
    }

    if let Err(e) = std::fs::rename(new, target) {
        let _ = std::fs::copy(new, target).with_context(|| {
            format!(
                "failed to copy {} to {} (rename also failed: {e})",
                new.display(),
                target.display()
            )
        })?;
        if let Err(e) = std::fs::remove_file(new) {
            tracing::warn!(error = %e, "failed to remove staged binary after copy");
        }
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(target, std::fs::Permissions::from_mode(0o755))?;
    }

    Ok(())
}

fn cleanup_old_files(install_dir: &Path) {
    let Ok(entries) = std::fs::read_dir(install_dir) else { return };
    for entry in entries.filter_map(std::result::Result::ok) {
        let path = entry.path();
        if path.extension().is_some_and(|e| e == "old")
            && path.is_file()
            && let Err(e) = std::fs::remove_file(&path)
        {
            tracing::warn!(error = %e, path = %path.display(), "failed to clean up old binary");
        }
    }
}

fn cleanup_staging_dirs(install_dir: &Path) {
    let updates_dir = install_dir.join(".updates");
    if updates_dir.exists()
        && let Err(e) = std::fs::remove_dir_all(&updates_dir)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(error = %e, "failed to clean up updates staging dir");
    }
}

async fn download_with_progress(
    url: &str,
    dest: &Path,
    on_progress: &(impl Fn(u64, u64) + Send + 'static),
) -> Result<()> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .context("failed to build download client")?;

    let response = client
        .get(url)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .context("download request failed")?;

    let total = response.content_length().unwrap_or(0);
    let downloaded = AtomicU64::new(0);

    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let mut file = tokio::fs::File::create(dest).await?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.context("stream error during download")?;
        file.write_all(&chunk).await?;
        let n = downloaded.fetch_add(chunk.len() as u64, Ordering::Relaxed) + chunk.len() as u64;
        if total > 0 {
            on_progress(n, total);
        }
    }

    file.flush().await?;
    Ok(())
}

fn extract_archive(archive_path: &Path, dest: &Path) -> Result<()> {
    let is_zip = archive_path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("zip"));
    let is_tar_zst =
        archive_path.to_str().is_some_and(|n| n.to_ascii_lowercase().ends_with(".tar.zst"));

    if is_zip {
        crate::util::unzip_file(archive_path, dest).context("failed to unzip archive")?;
    } else if is_tar_zst {
        let bytes = std::fs::read(archive_path).context("failed to read archive")?;
        crate::util::untar_zst_bytes(&bytes, dest).context("failed to extract tar.zst")?;
    } else {
        let name = archive_path.file_name().and_then(|n| n.to_str()).unwrap_or("unknown");
        anyhow::bail!("unsupported archive format: {name}");
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let binary = dest.join(release::binary_name());
        if binary.exists() {
            if let Err(e) =
                std::fs::set_permissions(&binary, std::fs::Permissions::from_mode(0o755))
            {
                tracing::warn!(error = %e, "failed to set executable permission on extracted binary");
            }
        }
    }

    Ok(())
}

fn verify_staged_binary(path: &Path) -> Result<()> {
    let output = std::process::Command::new(path)
        .arg("--version")
        .output()
        .context("failed to run staged binary --version")?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    anyhow::bail!("staged binary --version check failed: {stderr}");
}

async fn fetch_and_verify_checksum(
    checksum_asset: &release::ReleaseAsset,
    archive_path: &Path,
) -> Result<()> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .context("failed to build checksum client")?;

    let response = client
        .get(&checksum_asset.browser_download_url)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .context("failed to download checksum file")?;

    let body = response.text().await.context("failed to read checksum body")?;
    let expected = body.split_whitespace().next().unwrap_or("").trim();

    if expected.is_empty() {
        anyhow::bail!("checksum file is empty");
    }

    release::verify_checksum(archive_path, expected).context("checksum verification failed")?;
    Ok(())
}
