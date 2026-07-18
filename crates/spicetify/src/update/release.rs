use serde::Deserialize;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Deserialize)]
pub struct ReleaseAsset {
    pub name: String,
    pub browser_download_url: String,
    #[serde(default)]
    pub size: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReleaseInfo {
    pub tag_name: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub assets: Vec<ReleaseAsset>,
}

impl ReleaseInfo {
    #[must_use]
    pub fn version(&self) -> String {
        self.tag_name.trim_start_matches('v').to_string()
    }

    #[must_use]
    pub fn find_platform_asset(&self) -> Option<&ReleaseAsset> {
        let candidates = candidate_asset_names(&self.version());
        for name in &candidates {
            if let Some(asset) = self.assets.iter().find(|a| a.name == *name) {
                return Some(asset);
            }
        }
        None
    }

    #[must_use]
    pub fn find_checksum_asset(&self, asset_name: &str) -> Option<&ReleaseAsset> {
        let checksum_names = [format!("{asset_name}.sha256"), format!("{asset_name}.sha256sum")];
        for name in &checksum_names {
            if let Some(asset) = self.assets.iter().find(|a| a.name == *name) {
                return Some(asset);
            }
        }
        None
    }
}

#[must_use]
pub fn candidate_asset_names(version: &str) -> Vec<String> {
    let arch = std::env::consts::ARCH;
    let os = std::env::consts::OS;
    let ext = if cfg!(windows) { "zip" } else { "tar.zst" };
    let mut names = Vec::new();

    names.push(format!("spicetify-{version}-{os}-{arch}.{ext}"));

    let short_arch = short_arch_name(arch);
    if short_arch != arch {
        names.push(format!("spicetify-{version}-{os}-{short_arch}.{ext}"));
    }

    names.push(format!("portable-spicetify-{version}-{short_arch}.{ext}"));

    names
}

#[must_use]
pub fn short_arch_name(arch: &str) -> &str {
    match arch {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        _ => arch,
    }
}

#[must_use]
pub fn binary_name() -> &'static str {
    if cfg!(windows) { "spicetify.exe" } else { "spicetify" }
}

pub fn compute_sha256(path: &std::path::Path) -> std::io::Result<String> {
    let bytes = std::fs::read(path)?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn verify_checksum(path: &std::path::Path, expected: &str) -> Result<(), ChecksumError> {
    let actual = compute_sha256(path).map_err(ChecksumError::Io)?;
    if actual != expected {
        return Err(ChecksumError::Mismatch { expected: expected.to_string(), actual });
    }
    Ok(())
}

#[derive(Debug, thiserror::Error)]
pub enum ChecksumError {
    #[error("checksum mismatch: expected {expected}, got {actual}")]
    Mismatch { expected: String, actual: String },
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}
