use std::{
    collections::BTreeMap, fs, path::{Path, PathBuf}
};

use anyhow::{Result, anyhow};
use regex::Regex;
use serde::{Deserialize, Serialize};
use crate::i18n;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Store {
    pub installed: bool,
    pub artifacts: Vec<String>,
    #[serde(default)]
    pub checksum: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Module {
    pub enabled: String,
    pub v: BTreeMap<String, Store>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Vault {
    pub modules: BTreeMap<String, Module>,
}

impl Vault {
    pub fn get_module_mut(&mut self, identifier: &str) -> &mut Module {
        self.modules.entry(identifier.to_string()).or_default()
    }

    pub fn get_store_mut(&mut self, id: &StoreIdentifier) -> Option<&mut Store> {
        self.modules
            .get_mut(&id.module_identifier)?
            .v
            .get_mut(&id.version)
    }

    pub fn set_store(&mut self, id: &StoreIdentifier, store: Store) -> bool {
        if id.version.is_empty() {
            return false;
        }
        self.get_module_mut(&id.module_identifier)
            .v
            .insert(id.version.clone(), store);
        true
    }
}

#[derive(Debug, Clone)]
pub struct StoreIdentifier {
    pub module_identifier: String,
    pub version: String,
}

impl StoreIdentifier {
    pub fn parse(raw: &str) -> Result<Self> {
        let re = Regex::new(r"^([^@]+)@([^@]+)$")?;
        let cap = re
            .captures(raw)
            .ok_or_else(|| anyhow!(i18n::lookup("invalid_store_id")))?;

        Ok(Self {
            module_identifier: cap
                .get(1)
                .map(|m| m.as_str())
                .unwrap_or_default()
                .to_string(),
            version: cap
                .get(2)
                .map(|m| m.as_str())
                .unwrap_or_default()
                .to_string(),
        })
    }

    pub fn as_string(&self) -> String {
        format!("{}@{}", self.module_identifier, self.version)
    }

    pub fn store_path(&self, store_root: &Path) -> PathBuf {
        store_root.join(&self.module_identifier).join(&self.version)
    }

    pub fn module_link_path(&self, modules_root: &Path) -> PathBuf {
        modules_root.join(&self.module_identifier)
    }
}

pub fn load(path: &Path) -> Result<Vault> {
    if !path.exists() {
        return Ok(Vault::default());
    }
    let raw = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&raw)?)
}

pub fn save(path: &Path, vault: &Vault) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let raw = serde_json::to_string(vault)?;
    fs::write(path, raw)?;
    Ok(())
}

pub fn mutate(path: &Path, f: impl FnOnce(&mut Vault) -> bool) -> Result<()> {
    let mut vault = load(path)?;
    if !f(&mut vault) {
        anyhow::bail!(i18n::lookup("failed_mutate_vault"))
    }
    save(path, &vault)
}
