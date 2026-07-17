use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use regex_lite::Regex;
use serde::{Deserialize, Serialize};
use thiserror::Error;

static STORE_ID_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
    Regex::new(r"^[A-Za-z0-9._/-]+@[A-Za-z0-9._+-]+$")
        .expect("store id regex is a compile-time constant")
});

#[derive(Debug, Error)]
pub(crate) enum VaultError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("failed to parse vault.json: {0}")]
    Parse(#[from] serde_json::Error),

    #[error("invalid store id `{0}`: expected `module@version` (use `@` separator)")]
    InvalidStoreId(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub(crate) struct StoreIdentifier {
    pub(crate) module_identifier: String,
    pub(crate) version: String,
}

impl StoreIdentifier {
    pub(crate) fn parse(raw: &str) -> Result<Self, VaultError> {
        if !STORE_ID_RE.is_match(raw) {
            return Err(VaultError::InvalidStoreId(raw.to_string()));
        }
        let (module, version) =
            raw.split_once('@').ok_or_else(|| VaultError::InvalidStoreId(raw.to_string()))?;
        Ok(Self { module_identifier: module.to_string(), version: version.to_string() })
    }

    #[must_use]
    pub(crate) fn as_string(&self) -> String {
        format!("{}@{}", self.module_identifier, self.version)
    }

    #[must_use]
    pub(crate) fn store_path(&self, store_root: &Path) -> PathBuf {
        store_root.join(&self.module_identifier).join(&self.version)
    }

    #[must_use]
    pub(crate) fn module_link_path(&self, modules_root: &Path) -> PathBuf {
        modules_root.join(&self.module_identifier)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct Store {
    pub(crate) installed: bool,
    pub(crate) artifacts: Vec<String>,
    pub(crate) checksum: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct Module {
    pub(crate) v: BTreeMap<String, Store>,
    pub(crate) enabled: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct Vault {
    pub(crate) modules: BTreeMap<String, Module>,
}

impl Vault {
    pub(crate) fn get_module_mut(&mut self, module: &str) -> &mut Module {
        self.modules.entry(module.to_string()).or_default()
    }

    pub(crate) fn get_store_mut(&mut self, id: &StoreIdentifier) -> Option<&mut Store> {
        self.modules.get_mut(&id.module_identifier).and_then(|m| m.v.get_mut(&id.version))
    }

    pub(crate) fn set_store(&mut self, id: &StoreIdentifier, store: Store) {
        let m = self.get_module_mut(&id.module_identifier);
        let _ = m.v.insert(id.version.clone(), store);
    }
}

pub(crate) fn load(path: &Path) -> Result<Vault, VaultError> {
    if !path.exists() {
        return Ok(Vault::default());
    }
    let raw = std::fs::read_to_string(path)?;
    let v: Vault = serde_json::from_str(&raw)?;
    Ok(v)
}

pub(crate) fn save(path: &Path, vault: &Vault) -> Result<(), VaultError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let serialized = serde_json::to_string_pretty(vault)?;
    std::fs::write(path, serialized)?;
    Ok(())
}

pub(crate) fn mutate(path: &Path, f: impl FnOnce(&mut Vault) -> bool) -> Result<(), VaultError> {
    let mut v = load(path)?;
    if f(&mut v) {
        save(path, &v)?;
    }
    Ok(())
}
