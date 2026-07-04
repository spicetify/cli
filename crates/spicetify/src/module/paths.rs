use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub(crate) struct ModulePaths {
    pub vault_path: PathBuf,
    pub store_root: PathBuf,
    pub modules_root: PathBuf,
}

impl ModulePaths {
    pub(crate) fn from_config_root(root: &Path) -> Self {
        Self {
            vault_path: root.join("modules").join("vault.json"),
            store_root: root.join("store"),
            modules_root: root.join("modules"),
        }
    }
}
