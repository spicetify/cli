use std::path::{Path, PathBuf};

pub struct ModulePaths {
    pub modules_root: PathBuf,
    pub store_root: PathBuf,
    pub vault_path: PathBuf,
}

impl ModulePaths {
    pub fn from_config_root(root: &Path) -> Self {
        Self {
            modules_root: root.join("modules"),
            store_root: root.join("store"),
            vault_path: root.join("modules").join("vault.json"),
        }
    }
}
