pub(crate) mod paths;
pub(crate) mod vault;

use std::fs;
use std::path::Path;

pub(crate) use paths::ModulePaths;
pub(crate) use vault::{Store, StoreIdentifier, Vault};

use crate::error::{Result, wrap_error};
use crate::fl;

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
        .ok_or_else(|| crate::error::http_error(409, fl!("missing-store", id = id.as_string())))?;
    let artifact = store
        .artifacts
        .first()
        .ok_or_else(|| crate::error::http_error(409, fl!("store-no-artifacts")))?;

    let dest = id.store_path(&paths.store_root);
    fs::create_dir_all(&dest)?;
    if artifact.starts_with("http://") || artifact.starts_with("https://") {
        let response = reqwest::blocking::get(artifact).map_err(|e| {
            wrap_error(anyhow::anyhow!("{}", fl!("proxy-request-failed")).context(e), 502)
        })?;
        let bytes = response.bytes().map_err(|e| {
            wrap_error(anyhow::anyhow!("{}", fl!("proxy-request-failed")).context(e), 502)
        })?;
        let archive_path = dest.join("artifact.zip");
        fs::write(&archive_path, &bytes)?;
        // TODO: verify checksum against store.checksum before extracting
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
        if !id.version.is_empty() && !module.v.contains_key(&id.version) {
            return Err(crate::error::http_error(409, fl!("missing-store", id = id.as_string())));
        }
        if module.enabled == id.version {
            return Ok(());
        }
        module.enabled.clone_from(&id.version);
        module.enabled.clone()
    };

    // Sub-modules (identifiers containing '/') are served from the store
    // directory directly — no junction needed.
    if id.module_identifier.contains('/') {
        vault::save(&paths.vault_path, &v)?;
        return Ok(());
    }

    let link = id.module_link_path(&paths.modules_root);
    if let Err(e) = fs::remove_file(&link)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(error = %e, path = %link.display(), "failed to remove file");
    }
    if let Err(e) = fs::remove_dir_all(&link)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(error = %e, path = %link.display(), "failed to remove directory");
    }
    if !enabled.is_empty() {
        let src = id.store_path(&paths.store_root);
        super::util::link::create_dir_link(&src, &link)?;
    }
    vault::save(&paths.vault_path, &v)?;
    Ok(())
}

pub(crate) fn delete(paths: &ModulePaths, id: &StoreIdentifier) -> Result<()> {
    vault::mutate(&paths.vault_path, |v| {
        let module = v.get_module_mut(&id.module_identifier);
        if module.enabled == id.version {
            module.enabled.clear();
            // Sub-modules have no junction in the modules directory.
            if !id.module_identifier.contains('/') {
                let link = id.module_link_path(&paths.modules_root);
                if let Err(e) = fs::remove_file(&link)
                    && e.kind() != std::io::ErrorKind::NotFound
                {
                    tracing::warn!(error = %e, path = %link.display(), "failed to remove file");
                }
            }
        }
        if let Some(store) = module.v.get_mut(&id.version) {
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
        let _ = module.v.remove(&id.version);
        true
    })?;
    Ok(())
}

pub(crate) fn parse_enable_id(raw: &str) -> Result<StoreIdentifier> {
    if let Some(module_identifier) = raw.strip_suffix('@') {
        if module_identifier.is_empty() || module_identifier.contains('@') {
            return Err(crate::error::http_error(400, fl!("invalid-store-id")));
        }
        Ok(StoreIdentifier {
            module_identifier: module_identifier.to_string(),
            version: String::new(),
        })
    } else {
        Ok(StoreIdentifier::parse(raw)?)
    }
}
