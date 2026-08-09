pub(crate) mod cssmap;
pub(crate) mod expose;
pub(crate) mod remote;
pub(crate) mod stage;
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
        let modules_root = modules_dir(root);
        Self {
            vault_path: modules_root.join("vault.json"),
            store_root: root.join("store"),
            modules_root,
        }
    }
}

/// The one canonical modules directory, `<config>/modules`.
///
/// Older installs used `Modules`. On a case-insensitive filesystem that is
/// the same directory and this resolves immediately; on a case-sensitive one
/// it is a genuinely different directory, so it is moved across once. A
/// failed move is not fatal: the old location keeps working for this run.
pub(crate) fn modules_dir(config_root: &Path) -> PathBuf {
    let canonical = config_root.join("modules");
    let legacy = config_root.join("Modules");
    if !needs_migration(canonical.is_dir(), legacy.is_dir()) {
        return canonical;
    }
    match fs::rename(&legacy, &canonical) {
        Ok(()) => {
            tracing::info!("migrated {} -> {}", legacy.display(), canonical.display());
            canonical
        }
        Err(e) => {
            tracing::warn!(error = %e, "could not migrate {}; using it as-is", legacy.display());
            legacy
        }
    }
}

/// Whether the legacy directory has to be moved. Split out because the
/// interesting case only arises on a case-sensitive filesystem, where the two
/// names are distinct directories; on macOS and Windows they are the same one,
/// so the branch can never be exercised locally.
const fn needs_migration(canonical_exists: bool, legacy_exists: bool) -> bool {
    !canonical_exists && legacy_exists
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

/// Compares a downloaded artifact against the checksum the vault recorded
/// for it. `sha256:` prefixed or bare, either case.
fn verify_checksum(expected: &str, bytes: &[u8]) -> Result<()> {
    // Lowercase before stripping: an upper-case prefix is the same claim,
    // and stripping first would leave it in the compared value.
    let want = expected.trim().to_ascii_lowercase();
    let want = want.trim_start_matches("sha256:");
    let got = remote::digest(bytes);
    if want != got {
        anyhow::bail!("checksum mismatch: the vault declares sha256:{want}, the download is sha256:{got}");
    }
    Ok(())
}

pub(crate) fn install(paths: &ModulePaths, id: &StoreIdentifier) -> Result<()> {
    let mut v = vault::load(&paths.vault_path)?;
    let store = v
        .get_store_mut(id)
        .ok_or_else(|| anyhow::anyhow!(fl!("missing-store", id = id.to_string())))?;
    if store.artifacts.is_empty() {
        anyhow::bail!(fl!("store-no-artifacts"));
    }

    let dest = id.store_path(&paths.store_root);
    let mut downloaded = None;
    let mut failures = Vec::new();
    for artifact in &store.artifacts {
        if !(artifact.starts_with("http://") || artifact.starts_with("https://")) {
            // A local path is a developer's build linked in place; nothing
            // to download and nothing to verify.
            super::util::link::create_dir_link(Path::new(artifact), &dest)?;
            store.installed = true;
            vault::save(&paths.vault_path, &v)?;
            return Ok(());
        }
        let client = crate::http::blocking_client(30)
            .map_err(|e| anyhow::anyhow!("failed to build HTTP client: {e}"))?;
        // Artifacts are listed in preference order and later entries are
        // mirrors of the same bytes, so a host that has gone away costs an
        // attempt rather than the install.
        match client.get(artifact).send().and_then(reqwest::blocking::Response::bytes) {
            Ok(bytes) => {
                downloaded = Some(bytes);
                break;
            }
            Err(e) => failures.push(format!("{artifact}: {e}")),
        }
    }
    let Some(bytes) = downloaded else {
        anyhow::bail!("{}: {}", fl!("proxy-request-failed"), failures.join("; "));
    };

    // The registry indexes bytes it never wrote, so this is the check that
    // makes an install trustworthy. A missing checksum is loud rather than
    // fatal: local and hand-pointed artifacts legitimately have none.
    if store.checksum.is_empty() {
        tracing::warn!(
            "{id}: no checksum in the vault; installing unverified (sha256:{})",
            remote::digest(&bytes)
        );
    } else {
        verify_checksum(&store.checksum, &bytes)?;
        tracing::info!("{id}: checksum verified");
    }

    fs::create_dir_all(&dest)?;
    let archive_path = dest.join("artifact.zip");
    fs::write(&archive_path, &bytes)?;
    super::util::archive::unzip_file(&archive_path, &dest)?;
    if let Err(e) = fs::remove_file(&archive_path)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(error = %e, "failed to clean up downloaded zip");
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

/// Installs an artifact named directly rather than resolved from the vault.
/// There is no checksum to hold it to, so the install says so and prints the
/// digest it got, which is the only thing the user can compare against.
pub(crate) fn install_from_url(config_root: &Path, id_str: &str, url: &str) -> Result<()> {
    tracing::warn!(
        "installing {id_str} from an explicit URL: the vault is bypassed, so nothing verifies these bytes"
    );
    install_artifacts(config_root, id_str, vec![normalize_url(url)?], String::new())
}

/// Installs what the vault resolved: every mirror it listed, held to the
/// checksum it recorded.
pub(crate) fn install_from_vault(
    config_root: &Path,
    id_str: &str,
    artifacts: Vec<String>,
    checksum: String,
) -> Result<()> {
    install_artifacts(config_root, id_str, artifacts, checksum)
}

fn install_artifacts(
    config_root: &Path,
    id_str: &str,
    artifacts: Vec<String>,
    checksum: String,
) -> Result<()> {
    let id = StoreIdentifier::parse(id_str)?;
    let paths = ModulePaths::from_config_root(config_root);
    add_store(&paths, &id, Store { installed: false, artifacts, checksum })?;
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

#[cfg(test)]
mod tests {
    use super::{needs_migration, verify_checksum};

    #[test]
    fn accepts_the_checksum_the_vault_recorded_in_either_form() {
        // sha256 of "spicetify"
        let bytes = b"spicetify";
        let hex = super::remote::digest(bytes);
        assert!(verify_checksum(&format!("sha256:{hex}"), bytes).is_ok());
        assert!(verify_checksum(&hex, bytes).is_ok(), "a bare digest is the same claim");
        assert!(
            verify_checksum(&format!("SHA256:{}", hex.to_uppercase()), bytes).is_ok(),
            "case is not part of the claim"
        );
    }

    #[test]
    fn refuses_bytes_the_checksum_does_not_describe() {
        let err = verify_checksum(&format!("sha256:{}", "0".repeat(64)), b"spicetify")
            .expect_err("a mismatch must not install");
        assert!(err.to_string().contains("checksum mismatch"), "{err}");
    }

    #[test]
    fn migrates_only_when_the_legacy_name_is_the_sole_directory() {
        assert!(needs_migration(false, true), "case-sensitive FS with only Modules");
        assert!(!needs_migration(true, true), "both present: canonical already wins");
        assert!(!needs_migration(true, false), "already migrated");
        assert!(!needs_migration(false, false), "fresh install: nothing to move");
    }
}
