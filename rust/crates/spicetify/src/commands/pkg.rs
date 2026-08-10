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

/// The infrastructure a usable v3 client needs: stdlib is the foundation
/// every module builds on, and the store is how a user installs anything else
/// without the CLI. Not `manager`, which the store supersedes.
const SYSTEM_MODULES: &[&str] = &["stdlib", "store"];

/// Which system modules are not present on disk. Absence is the signal: a
/// disabled module keeps its directory, so this never re-seeds one the user
/// turned off, and a deliberate `pkg delete` of stdlib or store leaves a
/// client that cannot manage itself, so bringing it back is recovery.
fn missing_system_modules(modules_root: &Path) -> Vec<&'static str> {
    SYSTEM_MODULES.iter().copied().filter(|id| !modules_root.join(id).exists()).collect()
}

/// Installs and enables any absent system module from the registry, so a fresh
/// `apply` produces a client that can manage itself rather than a patched
/// Spotify with no stdlib and no store.
///
/// Best-effort by design, like the classmap fetch beside it: an unreachable
/// vault or a failed download warns and leaves the rest of the apply to
/// proceed, and a module already on disk is left alone for the store to
/// update. Disk-backed on purpose, so the store's later updates (which shadow
/// it through localStorage) always have a working version to fall back to.
pub(crate) fn ensure_system_modules(ctx: &AppContext) {
    let modules_root = crate::module::modules_dir(&ctx.config_root);
    let missing = missing_system_modules(&modules_root);
    if missing.is_empty() {
        return;
    }
    let vault = match fetch_vault(DEFAULT_VAULT) {
        Ok(vault) => vault,
        Err(e) => {
            tracing::warn!("cannot seed system modules ({}): {e}", missing.join(", "));
            return;
        }
    };
    for id in missing {
        if let Err(e) = seed_system_module(ctx, &vault, id) {
            tracing::warn!("could not seed system module {id}: {e}");
        }
    }
}

fn seed_system_module(ctx: &AppContext, vault: &Vault, id: &str) -> Result<()> {
    let module = vault.modules.get(id).ok_or_else(|| anyhow::anyhow!("not in the registry"))?;
    let version = resolve_version(module)?;
    let entry = module.v.get(&version).ok_or_else(|| anyhow::anyhow!("{version} is not in the registry"))?;
    if entry.artifacts.is_empty() {
        anyhow::bail!("{id}@{version} has no artifact");
    }
    let tag = format!("{id}@{version}");
    crate::module::install_from_vault(
        &ctx.config_root,
        &tag,
        entry.artifacts.clone(),
        entry.checksum.clone(),
    )?;
    crate::module::enable_module(&ctx.config_root, &tag)?;
    tracing::info!("seeded system module {tag}");
    Ok(())
}

/// The checksum the registry recorded for `id@version`, if it carries that
/// version at all.
///
/// Callers that did not resolve the module themselves (the `spicetify://`
/// handler, and so anything in the client that reaches it) use this rather
/// than a checksum handed to them, so the bytes are held to what was
/// published rather than to whatever the caller claims they should hash to.
pub(crate) fn registry_checksum(identifier: &str, version: &str) -> Option<String> {
    let vault = fetch_vault(DEFAULT_VAULT).ok()?;
    let entry = vault.modules.get(identifier)?.v.get(version)?;
    (!entry.checksum.is_empty()).then(|| entry.checksum.clone())
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

    // Network-gated smoke test for the real seeding path: fetch the registry,
    // download each system module, verify its checksum, and enable it into a
    // throwaway config. Run with `cargo test -p spicetify --ignored seed_live`.
    #[test]
    #[ignore = "hits the live registry and downloads artifacts"]
    fn seed_live_installs_and_enables_system_modules() {
        let root =
            std::env::temp_dir().join(format!("spicetify-seed-live-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("temp config");

        let vault = fetch_vault(DEFAULT_VAULT).expect("registry reachable");
        let ctx = AppContext::from_config(root.clone(), &crate::context::Config::default())
            .expect("context");
        for id in SYSTEM_MODULES {
            let result = seed_system_module(&ctx, &vault, id);
            assert!(result.is_ok(), "seed {id}: {:?}", result.err());
        }

        let modules_root = crate::module::modules_dir(&root);
        for id in SYSTEM_MODULES {
            let link = modules_root.join(id);
            assert!(link.exists(), "{id} enabled and reachable through modules/");
            assert!(
                link.join("metadata.json").is_file(),
                "{id} unpacked with its metadata"
            );
        }
        assert!(missing_system_modules(&modules_root).is_empty(), "nothing left to seed");

        std::fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn seeds_only_the_system_modules_that_are_absent() {
        let dir = std::env::temp_dir().join(format!("spicetify-seed-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp dir");

        assert_eq!(missing_system_modules(&dir), vec!["stdlib", "store"], "a fresh config needs both");

        std::fs::create_dir_all(dir.join("stdlib")).expect("stdlib dir");
        assert_eq!(missing_system_modules(&dir), vec!["store"], "an installed module is left alone");

        std::fs::create_dir_all(dir.join("store")).expect("store dir");
        assert!(missing_system_modules(&dir).is_empty(), "nothing to seed once both exist");

        std::fs::remove_dir_all(&dir).expect("cleanup");
    }
}
