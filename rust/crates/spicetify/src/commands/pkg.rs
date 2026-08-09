// `pkg`: install modules by identifier, resolved through the vault catalog.
//
// One registry: modules reach users by being submitted to it, where every
// entry is reviewed, checksummed and revocable. Code from anywhere else is
// still installable, but only by naming its artifact explicitly, which is a
// deliberate act rather than a source the CLI consults on its own.

use std::collections::BTreeMap;
use std::path::Path;

use serde::Deserialize;

use crate::context::AppContext;
use crate::error::Result;

const DEFAULT_VAULT: &str = "https://raw.githubusercontent.com/spicetify/modules/main/vault.json";

#[derive(Debug, Deserialize)]
struct VaultVersion {
    #[serde(default)]
    artifacts: Vec<String>,
    // Written by the publish pipeline; install refuses bytes that do not
    // match it.
    #[serde(default)]
    checksum: String,
}

#[derive(Debug, Deserialize)]
struct VaultModule {
    #[serde(default)]
    enabled: String,
    #[serde(default)]
    v: BTreeMap<String, VaultVersion>,
}

#[derive(Debug, Deserialize)]
struct Vault {
    #[serde(default)]
    modules: BTreeMap<String, VaultModule>,
}

fn fetch_vault(url: &str) -> Result<Vault> {
    let body = crate::http::vault_client()
        .get(url)
        .send()
        .map_err(|e| anyhow::anyhow!("cannot fetch vault {url}: {e}"))?
        .text()
        .map_err(|e| anyhow::anyhow!("cannot read vault {url}: {e}"))?;
    serde_json::from_str(&body).map_err(|e| anyhow::anyhow!("malformed vault {url}: {e}"))
}

/// The pinned `enabled` version when the vault names one, otherwise the
/// highest key. Mirrors the Go CLI's resolution.
fn resolve_version(module: &VaultModule) -> Result<String> {
    if !module.enabled.is_empty() {
        if module.v.contains_key(&module.enabled) {
            return Ok(module.enabled.clone());
        }
        anyhow::bail!("enabled version {} is not in the vault", module.enabled);
    }
    module.v.keys().next_back().cloned().ok_or_else(|| anyhow::anyhow!("no versions in the vault"))
}

/// Installed modules, read from disk rather than the vault.
fn installed(config_root: &Path) -> Vec<(String, String)> {
    let root = crate::module::modules_dir(config_root);
    let Ok(entries) = std::fs::read_dir(root) else { return Vec::new() };
    let mut out: Vec<(String, String)> = entries
        .filter_map(std::result::Result::ok)
        .filter(|e| e.path().is_dir())
        .filter_map(|e| {
            let id = e.file_name().to_str()?.to_string();
            let raw = std::fs::read_to_string(e.path().join("metadata.json")).ok()?;
            let meta: serde_json::Value = serde_json::from_str(&raw).ok()?;
            let version = meta.get("version").and_then(|v| v.as_str()).unwrap_or("?").to_string();
            Some((id, version))
        })
        .collect();
    out.sort();
    out
}

#[allow(clippy::unnecessary_wraps)]
pub(crate) fn list(ctx: &AppContext) -> Result<()> {
    let mods = installed(&ctx.config_root);
    if mods.is_empty() {
        tracing::info!("no modules installed");
    }
    for (id, version) in mods {
        tracing::info!("{id} {version}");
    }
    Ok(())
}

pub(crate) fn install(ctx: &AppContext, identifier: &str) -> Result<()> {
    let vault = fetch_vault(DEFAULT_VAULT)?;
    let Some(module) = vault.modules.get(identifier) else {
        let near: Vec<String> =
            vault.modules.keys().filter(|k| k.contains(identifier)).take(3).cloned().collect();
        if near.is_empty() {
            anyhow::bail!("module not found in the vault: {identifier}");
        }
        anyhow::bail!(
            "module not found in the vault: {identifier} (did you mean: {}?)",
            near.join(", ")
        );
    };
    let version = resolve_version(module)?;
    let Some(entry) = module.v.get(&version) else {
        anyhow::bail!("{identifier}@{version} is not in the vault");
    };
    if entry.artifacts.is_empty() {
        anyhow::bail!("{identifier}@{version} has no artifact in the vault");
    }
    tracing::info!("found {identifier}@{version}");
    crate::module::install_from_vault(
        &ctx.config_root,
        &format!("{identifier}@{version}"),
        entry.artifacts.clone(),
        entry.checksum.clone(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn module(enabled: &str, versions: &[&str]) -> VaultModule {
        VaultModule {
            enabled: enabled.to_string(),
            v: versions
                .iter()
                .map(|v| {
                    (
                        (*v).to_string(),
                        VaultVersion { artifacts: vec!["a".into()], checksum: String::new() },
                    )
                })
                .collect(),
        }
    }

    #[test]
    fn prefers_the_pinned_version() {
        let m = module("1.0.0", &["1.0.0", "2.0.0"]);
        assert_eq!(resolve_version(&m).expect("resolves"), "1.0.0");
    }

    #[test]
    fn falls_back_to_the_highest_version() {
        let m = module("", &["0.1.0", "0.2.0"]);
        assert_eq!(resolve_version(&m).expect("resolves"), "0.2.0");
    }

    #[test]
    fn rejects_a_pin_that_is_not_in_the_vault() {
        let m = module("9.9.9", &["1.0.0"]);
        assert!(resolve_version(&m).is_err());
    }

    #[test]
    fn rejects_an_empty_vault_entry() {
        assert!(resolve_version(&module("", &[])).is_err());
    }
}
