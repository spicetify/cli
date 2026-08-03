pub(crate) mod vault;

use std::fs;
use std::path::{Path, PathBuf};

pub(crate) use vault::{Store, StoreIdentifier, Vault};

use crate::error::Result;
use crate::fl;

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

pub(crate) fn initialize(paths: &ModulePaths) -> Result<()> {
    fs::create_dir_all(paths.vault_path.parent().expect("vault_path always has a parent"))?;
    vault::save(&paths.vault_path, &Vault::default())?;
    Ok(())
}

pub(crate) fn add_store(paths: &ModulePaths, id: &StoreIdentifier, store: Store) -> Result<()> {
    vault::mutate(&paths.vault_path, |v| {
        v.set_store(id, store);
        true
    })?;
    Ok(())
}

pub(crate) fn install(paths: &ModulePaths, id: &StoreIdentifier) -> Result<()> {
    let mut v = vault::load(&paths.vault_path)?;
    let store = v
        .get_store_mut(id)
        .ok_or_else(|| anyhow::anyhow!(fl!("missing-store", id = id.to_string())))?;
    let artifact =
        store.artifacts.first().ok_or_else(|| anyhow::anyhow!(fl!("store-no-artifacts")))?;

    let dest = id.store_path(&paths.store_root);
    if artifact.starts_with("http://") || artifact.starts_with("https://") {
        fs::create_dir_all(&dest)?;
        let client = crate::http::blocking_client(30)
            .map_err(|e| anyhow::anyhow!("failed to build HTTP client: {e}"))?;
        let response = client
            .get(artifact)
            .send()
            .map_err(|e| anyhow::anyhow!("{}: {e}", fl!("proxy-request-failed")))?;
        let bytes = response
            .bytes()
            .map_err(|e| anyhow::anyhow!("{}: {e}", fl!("proxy-request-failed")))?;
        let archive_path = dest.join("artifact.zip");
        fs::write(&archive_path, &bytes)?;
        super::util::archive::unzip_file(&archive_path, &dest)?;
        if let Err(e) = fs::remove_file(&archive_path)
            && e.kind() != std::io::ErrorKind::NotFound
        {
            tracing::warn!(error = %e, "failed to clean up downloaded zip");
        }
    } else {
        let src = Path::new(artifact);
        super::util::link::create_dir_link(src, &dest)?;
    }

    store.installed = true;
    vault::save(&paths.vault_path, &v)?;
    Ok(())
}

pub(crate) fn enable(paths: &ModulePaths, id: &StoreIdentifier) -> Result<()> {
    let mut v = vault::load(&paths.vault_path)?;
    let enabled = {
        let module = v.get_module_mut(&id.module_identifier);
        if !id.version.is_empty() && !module.versions.contains_key(&id.version) {
            return Err(anyhow::anyhow!(fl!("missing-store", id = id.to_string())));
        }
        if module.enabled.as_deref() == Some(&id.version) {
            return Ok(());
        }
        module.enabled = (!id.version.is_empty()).then(|| id.version.clone());
        module.enabled.clone()
    };

    if id.module_identifier.contains('/') {
        vault::save(&paths.vault_path, &v)?;
        return Ok(());
    }

    let link = id.module_link_path(&paths.modules_root);
    if let Err(e) = crate::util::remove_dir_link(&link) {
        tracing::warn!(error = %e, path = %link.display(), "failed to remove link");
    }
    if enabled.is_some() {
        let src = id.store_path(&paths.store_root);
        super::util::link::create_dir_link(&src, &link)?;
    }
    vault::save(&paths.vault_path, &v)?;
    Ok(())
}

pub(crate) fn delete(paths: &ModulePaths, id: &StoreIdentifier) -> Result<()> {
    vault::mutate(&paths.vault_path, |v| {
        let module = v.get_module_mut(&id.module_identifier);
        if module.enabled.as_deref() == Some(&id.version) {
            module.enabled = None;
            if !id.module_identifier.contains('/') {
                let link = id.module_link_path(&paths.modules_root);
                if let Err(e) = crate::util::remove_dir_link(&link) {
                    tracing::warn!(error = %e, path = %link.display(), "failed to remove link");
                }
            }
        }
        if let Some(store) = module.versions.get_mut(&id.version) {
            store.installed = false;
        }
        true
    })?;
    if let Err(e) = fs::remove_dir_all(id.store_path(&paths.store_root))
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(error = %e, path = %id.store_path(&paths.store_root).display(), "failed to remove directory");
    }
    Ok(())
}

pub(crate) fn remove_store(paths: &ModulePaths, id: &StoreIdentifier) -> Result<()> {
    vault::mutate(&paths.vault_path, |v| {
        let module = v.get_module_mut(&id.module_identifier);
        drop(module.versions.remove(&id.version));
        true
    })?;
    Ok(())
}

pub(crate) fn parse_enable_id(raw: &str) -> Result<StoreIdentifier> {
    if let Some(module_identifier) = raw.strip_suffix('@') {
        if module_identifier.is_empty() || module_identifier.contains('@') {
            return Err(anyhow::anyhow!(fl!("invalid-store-id")));
        }
        Ok(StoreIdentifier {
            module_identifier: module_identifier.to_string(),
            version: String::new(),
        })
    } else {
        Ok(StoreIdentifier::parse(raw)?)
    }
}

pub(crate) fn install_from_url(config_root: &Path, id_str: &str, url: &str) -> Result<()> {
    let id = StoreIdentifier::parse(id_str)?;
    let paths = ModulePaths::from_config_root(config_root);
    let normalized = normalize_url(url)?;
    add_store(
        &paths,
        &id,
        Store { installed: false, artifacts: vec![normalized], checksum: String::new() },
    )?;
    install(&paths, &id)?;
    tracing::info!("{}", fl!("module-added"));
    Ok(())
}

pub(crate) fn delete_module(config_root: &Path, id_str: &str) -> Result<()> {
    let id = StoreIdentifier::parse(id_str)?;
    let paths = ModulePaths::from_config_root(config_root);
    delete(&paths, &id)?;
    remove_store(&paths, &id)?;
    tracing::info!("{}", fl!("module-deleted"));
    Ok(())
}

pub(crate) fn enable_module(config_root: &Path, id_str: &str) -> Result<()> {
    let id = StoreIdentifier::parse(id_str)?;
    let paths = ModulePaths::from_config_root(config_root);
    enable(&paths, &id)?;
    tracing::info!("{}", fl!("module-enabled"));
    Ok(())
}

fn normalize_url(raw: &str) -> Result<String> {
    if raw.starts_with("http://") || raw.starts_with("https://") {
        return Ok(raw.to_string());
    }
    let path = PathBuf::from(raw);
    if path.is_absolute() {
        return Ok(path.to_string_lossy().to_string());
    }
    let abs = std::env::current_dir()?.join(&path);
    Ok(abs.to_string_lossy().to_string())
}
