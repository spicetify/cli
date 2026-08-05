// `pkg`: install modules by identifier, resolved through the vault catalog.
//
// The Go CLI's semantics are the contract here: users install by id, not by
// artifact URL, and community vaults must be trusted before they are
// consulted. Trust state lives beside the config so either binary can read it.

use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::context::AppContext;
use crate::error::Result;

const DEFAULT_VAULT: &str = "https://raw.githubusercontent.com/spicetify/modules/main/vault.json";
const COMMUNITY_VAULTS: &str =
    "https://raw.githubusercontent.com/spicetify/modules/main/community-vaults.json";
const TRUSTED_FILE: &str = "trusted-vaults.json";

#[derive(Debug, Deserialize)]
struct VaultVersion {
    #[serde(default)]
    artifacts: Vec<String>,
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

#[derive(Debug, Default, Serialize, Deserialize)]
struct Trusted {
    #[serde(default)]
    vaults: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct CommunityVault {
    name: String,
    url: String,
}

fn trusted_path(ctx: &AppContext) -> std::path::PathBuf {
    ctx.config_root.join(TRUSTED_FILE)
}

fn load_trusted(ctx: &AppContext) -> Trusted {
    std::fs::read_to_string(trusted_path(ctx))
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

/// The default vault plus every trusted community vault, in that order.
fn vault_urls(ctx: &AppContext) -> Vec<String> {
    let mut urls = vec![DEFAULT_VAULT.to_string()];
    urls.extend(load_trusted(ctx).vaults);
    urls
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
    let mut near = Vec::new();
    for url in vault_urls(ctx) {
        let vault = match fetch_vault(&url) {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!("{e}");
                continue;
            }
        };
        let Some(module) = vault.modules.get(identifier) else {
            near.extend(vault.modules.keys().filter(|k| k.contains(identifier)).take(3).cloned());
            continue;
        };
        let version = resolve_version(module)?;
        let Some(artifact) = module.v.get(&version).and_then(|v| v.artifacts.first()) else {
            anyhow::bail!("{identifier}@{version} has no artifact in {url}");
        };
        tracing::info!("found {identifier}@{version} in {url}");
        return crate::module::install_from_url(
            &ctx.config_root,
            &format!("{identifier}@{version}"),
            artifact,
        );
    }
    if near.is_empty() {
        anyhow::bail!("module not found in any vault: {identifier}");
    }
    anyhow::bail!(
        "module not found in any vault: {identifier} (did you mean: {}?)",
        near.join(", ")
    )
}

/// Adds a community vault by name or URL. Only HTTPS origins are accepted:
/// a vault is a source of code that ends up executing in the client.
pub(crate) fn trust(ctx: &AppContext, target: &str) -> Result<()> {
    let url = if target.starts_with("http") {
        target.to_string()
    } else {
        let listed: Vec<CommunityVault> = crate::http::vault_client()
            .get(COMMUNITY_VAULTS)
            .send()
            .and_then(reqwest::blocking::Response::json)
            .map_err(|e| anyhow::anyhow!("cannot fetch the community vault list: {e}"))?;
        listed
            .into_iter()
            .find(|v| v.name == target)
            .map(|v| v.url)
            .ok_or_else(|| anyhow::anyhow!("no community vault named {target}"))?
    };
    if !url.starts_with("https://") {
        anyhow::bail!("refusing to trust a non-HTTPS vault: {url}");
    }

    let mut trusted = load_trusted(ctx);
    if trusted.vaults.contains(&url) {
        tracing::info!("already trusted: {url}");
        return Ok(());
    }
    trusted.vaults.push(url.clone());
    std::fs::write(trusted_path(ctx), serde_json::to_string_pretty(&trusted)?)?;
    tracing::info!("trusted {url}");
    Ok(())
}

pub(crate) fn untrust(ctx: &AppContext, url: &str) -> Result<()> {
    let mut trusted = load_trusted(ctx);
    let before = trusted.vaults.len();
    trusted.vaults.retain(|v| v != url);
    if trusted.vaults.len() == before {
        tracing::info!("not trusted: {url}");
        return Ok(());
    }
    std::fs::write(trusted_path(ctx), serde_json::to_string_pretty(&trusted)?)?;
    tracing::info!("revoked {url}");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn module(enabled: &str, versions: &[&str]) -> VaultModule {
        VaultModule {
            enabled: enabled.to_string(),
            v: versions
                .iter()
                .map(|v| ((*v).to_string(), VaultVersion { artifacts: vec!["a".into()] }))
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
