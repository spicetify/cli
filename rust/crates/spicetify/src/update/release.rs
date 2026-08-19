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
    // GitHub sends explicit `null` for a release created without a name or
    // body (every workflow-cut v3 release), and `#[serde(default)]` alone
    // only covers a MISSING field, so both need the null-tolerant path.
    #[serde(default, deserialize_with = "null_as_default")]
    pub name: String,
    #[serde(default, deserialize_with = "null_as_default")]
    pub body: String,
    #[serde(default)]
    pub assets: Vec<ReleaseAsset>,
}

fn null_as_default<'de, D: serde::Deserializer<'de>>(deserializer: D) -> Result<String, D::Error> {
    Ok(Option::<String>::deserialize(deserializer)?.unwrap_or_default())
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
    Ok(hex::encode(hasher.finalize()))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_the_real_release_list_shape() {
        // Trimmed from the live GitHub API: workflow-cut releases carry
        // explicit nulls for name and body, which is what broke the first
        // list-based self-update in the field.
        let json = r#"[
            {"tag_name": "v3.0.0-beta.8", "name": null, "body": null,
             "assets": [{"name": "spicetify-3.0.0-beta.8-macos-aarch64.tar.gz",
                         "browser_download_url": "https://example.com/a.tar.gz", "size": 1}]},
            {"tag_name": "v2.44.0", "name": "v2.44.0", "body": "notes", "assets": []}
        ]"#;
        let releases: Vec<ReleaseInfo> = serde_json::from_str(json).expect("null fields tolerated");
        assert_eq!(releases.len(), 2);
        assert_eq!(releases[0].version(), "3.0.0-beta.8");
        assert_eq!(releases[0].name, "");
        assert_eq!(releases[1].body, "notes");
    }
}
