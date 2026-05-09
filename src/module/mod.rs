pub mod paths;
pub mod vault;

use std::fs;

use anyhow::{Result, anyhow, bail};
pub use paths::ModulePaths;
pub use vault::{Store, StoreIdentifier, Vault};

use crate::util;

pub fn initialize(paths: &ModulePaths) -> Result<()> {
    vault::save(&paths.vault_path, &Vault::default())
}

pub fn add_store(paths: &ModulePaths, id: &StoreIdentifier, store: Store) -> Result<()> {
    vault::mutate(&paths.vault_path, |v| v.set_store(id, store))
}

pub fn install(paths: &ModulePaths, id: &StoreIdentifier) -> Result<()> {
    let mut v = vault::load(&paths.vault_path)?;
    let store = v
        .get_store_mut(id)
        .ok_or_else(|| anyhow!("missing store {}", id.as_string()))?;
    // TODO: add more artifact options (Go: "add more options")
    // Currently only uses the first artifact (artifacts[0]). Go's module.go:160 has the same
    // limitation. Should support selecting from multiple artifact URLs (e.g. mirror fallback,
    // platform-specific artifacts).
    let artifact = store
        .artifacts
        .first()
        .cloned()
        .ok_or_else(|| anyhow!("store has no artifacts"))?;

    // TODO: verify artifact checksum before/during installation
    // Go's module.go:135 has the same TODO. The checksum field on Store is never validated.
    if artifact.starts_with("http://") || artifact.starts_with("https://") {
        let response = reqwest::blocking::get(&artifact)?;
        let bytes = response.bytes()?;
        let dest = id.store_path(&paths.store_root);
        fs::create_dir_all(&dest)?;
        let archive = dest.join("artifact.zip");
        fs::write(&archive, &bytes)?;
        util::unzip_file(&archive, &dest)?;
        let _ = fs::remove_file(&archive);
    } else {
        let src = std::path::PathBuf::from(&artifact);
        let dest = id.store_path(&paths.store_root);
        util::create_dir_link(&src, &dest)?;
    }

    store.installed = true;
    vault::save(&paths.vault_path, &v)
}

pub fn enable(paths: &ModulePaths, id: &StoreIdentifier) -> Result<()> {
    let mut v = vault::load(&paths.vault_path)?;
    let enabled = {
        let module = v.get_module_mut(&id.module_identifier);

        if !id.version.is_empty() && !module.v.contains_key(&id.version) {
            bail!("missing store {}", id.as_string());
        }

        if module.enabled == id.version {
            return Ok(());
        }

        module.enabled = id.version.clone();
        module.enabled.clone()
    };

    let link = id.module_link_path(&paths.modules_root);
    let _ = fs::remove_file(&link);
    let _ = fs::remove_dir_all(&link);

    if !enabled.is_empty() {
        let src = id.store_path(&paths.store_root);
        util::create_dir_link(&src, &link)?;
    }
    vault::save(&paths.vault_path, &v)
}

pub fn delete(paths: &ModulePaths, id: &StoreIdentifier) -> Result<()> {
    vault::mutate(&paths.vault_path, |v| {
        let module = v.get_module_mut(&id.module_identifier);

        if module.enabled == id.version {
            module.enabled.clear();
            let link = id.module_link_path(&paths.modules_root);
            let _ = fs::remove_file(&link);
        }
        if let Some(store) = module.v.get_mut(&id.version) {
            store.installed = false;
        }
        true
    })?;
    let _ = fs::remove_dir_all(id.store_path(&paths.store_root));
    Ok(())
}

pub fn remove_store(paths: &ModulePaths, id: &StoreIdentifier) -> Result<()> {
    vault::mutate(&paths.vault_path, |v| {
        let module = v.get_module_mut(&id.module_identifier);
        module.v.remove(&id.version);
        true
    })
}

pub fn parse_enable_id(raw: &str) -> Result<StoreIdentifier> {
    if let Some(module_identifier) = raw.strip_suffix('@') {
        if module_identifier.is_empty() || module_identifier.contains('@') {
            bail!("invalid store id, expected module@version")
        }
        Ok(StoreIdentifier {
            module_identifier: module_identifier.to_string(),
            version: String::new(),
        })
    } else {
        StoreIdentifier::parse(raw)
    }
}
