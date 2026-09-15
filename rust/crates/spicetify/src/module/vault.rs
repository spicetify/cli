use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use regex::Regex;
use serde::{Deserialize, Serialize};
use thiserror::Error;

static STORE_ID_RE: std::sync::LazyLock<Regex> = std::sync::LazyLock::new(|| {
    Regex::new(r"\A[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*@[A-Za-z0-9._+-]*\z")
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

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) struct StoreIdentifier {
    module_identifier: String,
    version: String,
}

impl StoreIdentifier {
    pub(crate) fn parse(raw: &str) -> Result<Self, VaultError> {
        let id = Self::parse_enable(raw)?;
        if id.version.is_empty() {
            return Err(VaultError::InvalidStoreId(raw.to_string()));
        }
        Ok(id)
    }

    pub(crate) fn parse_enable(raw: &str) -> Result<Self, VaultError> {
        if !STORE_ID_RE.is_match(raw) {
            return Err(VaultError::InvalidStoreId(raw.to_string()));
        }
        let (module, version) =
            raw.split_once('@').ok_or_else(|| VaultError::InvalidStoreId(raw.to_string()))?;
        if !module.split('/').all(portable_component)
            || (!version.is_empty() && !portable_component(version))
        {
            return Err(VaultError::InvalidStoreId(raw.to_string()));
        }
        Ok(Self { module_identifier: module.to_string(), version: version.to_string() })
    }

    pub(crate) fn disabled(module: &str) -> Result<Self, VaultError> {
        Self::parse_enable(&format!("{module}@"))
    }

    pub(crate) fn module_identifier(&self) -> &str {
        &self.module_identifier
    }

    pub(crate) fn version(&self) -> &str {
        &self.version
    }

    pub(crate) fn is_within_module(&self, module: &str) -> bool {
        self.module_identifier
            .split('/')
            .next()
            .is_some_and(|root| root.eq_ignore_ascii_case(module))
    }

    pub(crate) fn store_path(&self, store_root: &Path) -> Result<PathBuf, VaultError> {
        if self.version.is_empty() {
            return Err(VaultError::InvalidStoreId(self.to_string()));
        }
        crate::util::link::ensure_no_links(store_root, Path::new(&self.module_identifier))?;
        Ok(store_root.join(&self.module_identifier).join(&self.version))
    }

    #[must_use]
    pub(crate) fn module_link_path(&self, modules_root: &Path) -> PathBuf {
        modules_root.join(&self.module_identifier)
    }
}

// Use the same names on every OS. Windows normalizes trailing dots and treats
// device names specially, even with an extension, so neither is a package name.
fn portable_component(component: &str) -> bool {
    if component.is_empty() || component.ends_with('.') {
        return false;
    }
    let stem = component.split('.').next().unwrap_or_default().to_ascii_uppercase();
    !matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        && !stem.strip_prefix("COM").or_else(|| stem.strip_prefix("LPT")).is_some_and(|suffix| {
            matches!(suffix, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9")
        })
}

impl std::fmt::Display for StoreIdentifier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}@{}", self.module_identifier, self.version)
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
    #[serde(rename = "v")]
    pub(crate) versions: BTreeMap<String, Store>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) enabled: Option<String>,
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
        self.modules.get_mut(&id.module_identifier).and_then(|m| m.versions.get_mut(&id.version))
    }

    pub(crate) fn set_store(&mut self, id: &StoreIdentifier, store: Store) {
        let m = self.get_module_mut(&id.module_identifier);
        drop(m.versions.insert(id.version.clone(), store));
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn store_ids_reject_path_components_and_platform_aliases() {
        for raw in [
            "../victim@1",
            "/victim@1",
            "./module@1",
            "a/../victim@1",
            "a/./b@1",
            "a//b@1",
            "a/@1",
            "module@.",
            "module@..",
            "module.@1",
            "module@1.",
            "CON@1",
            "owner/nul.txt@1",
            "module@COM1",
            "owner/CoM1.txt@1",
            "module@lpT9.data",
            "module@.. ",
            "C:/victim@1",
            "//server/share@1",
            r"C:\victim@1",
            r"a\..\victim@1",
            "module@1\n",
            "module@",
            "@1",
        ] {
            assert!(StoreIdentifier::parse(raw).is_err(), "unsafe ID accepted: {raw:?}");
        }
    }

    #[test]
    fn store_ids_preserve_nested_names_and_release_versions() {
        for raw in [
            "module@1.0.0",
            "owner/module@1.0.0-beta.1+build",
            "a/b/c@dev",
            "my_module.v2@v3",
            ".hidden@latest",
            "MyModule@Beta+Build",
        ] {
            let id = StoreIdentifier::parse(raw).expect("valid store ID");
            assert_eq!(id.to_string(), raw);
        }
    }

    #[test]
    fn disabled_ids_never_resolve_to_a_whole_module_directory() {
        let id = StoreIdentifier::disabled("owner/module").expect("valid disabled ID");
        assert!(id.store_path(Path::new("store")).is_err());
    }
}
