use anyhow::{Context, Result};

use crate::i18n;

pub struct InstallAsset {
    pub name: String,
    pub download_url: String,
}

pub struct ReleaseInfo {
    pub tag: String,
    pub version: String,
    pub assets: Vec<InstallAsset>,
}

impl ReleaseInfo {
    pub fn from_json(release: &serde_json::Value) -> Result<Self> {
        let tag = release["tag_name"].as_str().unwrap_or("v0.0.0").to_string();
        let version = tag.strip_prefix('v').unwrap_or(&tag).to_string();

        let assets = release["assets"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|a| {
                        Some(InstallAsset {
                            name: a["name"].as_str()?.to_string(),
                            download_url: a["browser_download_url"].as_str()?.to_string(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(Self {
            tag,
            version,
            assets,
        })
    }

    pub fn is_update_available(&self, current_version: &str) -> bool {
        let remote = semver::Version::parse(&self.version).ok();
        let current = semver::Version::parse(current_version).ok();
        match (remote, current) {
            (Some(r), Some(c)) => r > c,
            _ => self.version != current_version,
        }
    }

    pub fn find_installer(&self) -> Option<&InstallAsset> {
        self.assets.iter().find(|a| {
            a.name == format!("installer-{}-windows-amd64.exe", self.version)
                || a.name == format!("installer-{}-windows-arm64.exe", self.version)
        })
    }

    pub fn find_installer_err(&self) -> Result<&InstallAsset> {
        let name = format!("installer-{}-windows-amd64.exe", self.version);
        self.find_installer()
            .with_context(|| i18n::lookup_with_args("no_release_asset", &[("name", &name)]))
    }
}
