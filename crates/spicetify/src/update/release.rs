use serde::{Deserialize, Serialize};

use crate::update::archive;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallAsset {
    pub name: String,
    pub browser_download_url: String,
    #[serde(default)]
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseInfo {
    pub tag_name: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub assets: Vec<InstallAsset>,
}

impl ReleaseInfo {
    #[must_use]
    pub fn version(&self) -> String {
        self.tag_name.trim_start_matches('v').to_string()
    }

    #[must_use]
    pub fn find_platform_asset(&self) -> Option<&InstallAsset> {
        let candidates = archive::candidate_asset_names(&self.version());
        for name in &candidates {
            if let Some(asset) = self.assets.iter().find(|a| a.name == *name) {
                return Some(asset);
            }
        }
        None
    }
}
