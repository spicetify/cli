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

fn fetch_vault_body(url: &str) -> Result<String> {
    crate::http::vault_client()
        .get(url)
        .send()
        .map_err(|e| anyhow::anyhow!("cannot fetch vault {url}: {e}"))?
        .text()
        .map_err(|e| anyhow::anyhow!("cannot read vault {url}: {e}"))
}

const VAULT_CACHE_TTL: std::time::Duration = std::time::Duration::from_mins(5);

fn vault_cache_path(config_root: &Path) -> std::path::PathBuf {
    config_root.join("cache").join("vault.json")
}

/// The registry, served through a short-lived disk cache. A fresh cached
/// copy skips the network entirely: `apply` is a recovery path and must not
/// stall behind a hung fetch, and one store-driven update otherwise touches
/// the vault up to three times (catalog, checksum, refresh). A failed fetch
/// falls back to whatever is cached, however stale, with a warning, so an
/// offline apply still evaluates the system modules instead of skipping.
fn cached_vault(config_root: &Path) -> Result<Vault> {
    vault_via_cache(
        &vault_cache_path(config_root),
        VAULT_CACHE_TTL,
        std::time::SystemTime::now(),
        || fetch_vault_body(DEFAULT_VAULT),
    )
}

fn read_cached_vault(path: &Path) -> Option<Vault> {
    serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()
}

fn vault_via_cache(
    path: &Path,
    ttl: std::time::Duration,
    now: std::time::SystemTime,
    fetch: impl FnOnce() -> Result<String>,
) -> Result<Vault> {
    let fresh = std::fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|modified| now.duration_since(modified).ok())
        .is_some_and(|age| age <= ttl);
    // A corrupt cache never satisfies a read, fresh or stale, so it simply
    // falls through to the fetch.
    if fresh && let Some(vault) = read_cached_vault(path) {
        return Ok(vault);
    }
    match fetch() {
        Ok(body) => {
            let vault = serde_json::from_str(&body)
                .map_err(|e| anyhow::anyhow!("malformed vault {DEFAULT_VAULT}: {e}"))?;
            if let Some(dir) = path.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            if let Err(e) = std::fs::write(path, &body) {
                tracing::warn!("cannot cache the vault at {}: {e}", path.display());
            }
            Ok(vault)
        }
        Err(e) => match read_cached_vault(path) {
            Some(vault) => {
                tracing::warn!("vault fetch failed ({e}); using the cached copy");
                Ok(vault)
            }
            None => Err(e),
        },
    }
}

/// The pinned `enabled` version when the vault names one, otherwise the
/// highest version by semver precedence. The map's own key order is
/// lexicographic, which puts 1.7.0 above 1.10.0; a key that does not parse
/// as semver ranks below every one that does.
fn resolve_version(module: &VaultModule) -> Result<String> {
    if !module.enabled.is_empty() {
        if module.v.contains_key(&module.enabled) {
            return Ok(module.enabled.clone());
        }
        anyhow::bail!("enabled version {} is not in the vault", module.enabled);
    }
    module
        .v
        .keys()
        .max_by_key(|k| semver::Version::parse(k).ok())
        .cloned()
        .ok_or_else(|| anyhow::anyhow!("no versions in the vault"))
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

/// The infrastructure a usable v3 client needs: stdlib is the foundation,
/// the store installs modules, and manager provides the profile-menu settings
/// and recovery surface. They are independently useful management surfaces.
const SYSTEM_MODULES: &[&str] = &["stdlib", "store", "manager"];

/// Installs any absent system module and refreshes any outdated store-managed
/// one from the registry, so every `apply` leaves a client that can manage
/// itself over a current disk baseline. The baseline is what actually runs
/// after a Spotify update: the new build changes the classmap key, which
/// shadows every localStorage record until the store re-remaps them, and the
/// window in between is served entirely from these copies.
///
/// Best-effort by design, like the classmap fetch beside it: an unreachable
/// vault or a failed download warns and leaves the rest of the apply to
/// proceed. Only links into the store tree are ever replaced; a developer's
/// real directory or a link into their own build output is never judged
/// against the registry. Deliberate user intent recorded in the local vault
/// wins over freshness: a module disabled while still installed stays off,
/// and a hand-pin (an enabled version below one still installed) stays
/// pinned; a `pkg delete`, which clears the installed flags, still re-seeds,
/// because a client without its management surfaces cannot recover itself.
pub(crate) fn ensure_system_modules(ctx: &AppContext) {
    let paths = crate::module::ModulePaths::from_config_root(&ctx.config_root);
    let vault = match cached_vault(&ctx.config_root) {
        Ok(vault) => vault,
        Err(e) => {
            tracing::warn!("cannot check system modules against the registry: {e}");
            return;
        }
    };
    let intent = crate::module::vault::load(&paths.vault_path).unwrap_or_default();
    for id in SYSTEM_MODULES {
        if intent.modules.get(*id).is_some_and(local_intent_blocks) {
            continue;
        }
        let present = paths.modules_root.join(id).exists();
        let installed = store_managed_version(&paths.modules_root, &paths.store_root, id);
        let Some(module) = vault.modules.get(*id) else {
            tracing::warn!("system module {id} is not in the registry");
            continue;
        };
        let target = match resolve_version(module) {
            Ok(version) => version,
            Err(e) => {
                tracing::warn!("cannot resolve system module {id}: {e}");
                continue;
            }
        };
        if !should_stage(present, installed.as_deref(), &target, !module.enabled.is_empty()) {
            continue;
        }
        let Some(entry) = module.v.get(&target) else {
            tracing::warn!("system module {id}@{target} is not in the registry");
            continue;
        };
        if let Err(e) = seed_system_module(ctx, id, &target, entry) {
            tracing::warn!("could not stage system module {id}@{target}: {e}");
            continue;
        }
        // The version this refresh just superseded would otherwise sit in
        // the store tree forever, a megabyte per release.
        if let Some(old) = installed.filter(|old| old != &target) {
            let superseded = crate::module::vault::StoreIdentifier {
                module_identifier: (*id).to_string(),
                version: old,
            };
            if let Err(e) = crate::module::delete(&paths, &superseded) {
                tracing::warn!("could not collect superseded {superseded}: {e}");
            }
        }
    }
}

/// Whether the local vault records intent this refresh must not override:
/// disabled while still installed, or pinned to an enabled version below one
/// that is still installed (the only way a downgrade comes about by hand).
/// A deleted module has no installed versions left and is fair game.
fn local_intent_blocks(module: &crate::module::vault::Module) -> bool {
    let has_installed = module.versions.values().any(|store| store.installed);
    match &module.enabled {
        None => has_installed,
        Some(pin) => {
            let Ok(pin) = semver::Version::parse(pin) else { return false };
            module.versions.keys().filter_map(|v| semver::Version::parse(v).ok()).any(|v| v > pin)
        }
    }
}

/// The version behind `modules_root/<id>` when it is a store-managed link:
/// such a link resolves into `store/<id>/<version>`, so the resolved
/// directory name is the version. Anything else (a real directory, a link
/// into a developer's build output, a dangling link) resolves elsewhere or
/// not at all and yields `None`.
fn store_managed_version(modules_root: &Path, store_root: &Path, id: &str) -> Option<String> {
    let resolved = std::fs::canonicalize(modules_root.join(id)).ok()?;
    let store = std::fs::canonicalize(store_root.join(id)).ok()?;
    if !resolved.starts_with(&store) {
        return None;
    }
    Some(resolved.file_name()?.to_str()?.to_string())
}

/// Whether the registry's `target` should replace what is on disk: an absent
/// module is always staged; a store-managed one for a strictly newer semver,
/// or for any different version when the registry pins `target` (a pin is a
/// maintainer rolling a bad release back, the one case where moving
/// backwards is right). `installed: None` on a present module is not
/// store-managed and is never replaced.
fn should_stage(present: bool, installed: Option<&str>, target: &str, target_pinned: bool) -> bool {
    if !present {
        return true;
    }
    let Some(installed) = installed else { return false };
    match (semver::Version::parse(target), semver::Version::parse(installed)) {
        (Ok(target), Ok(installed)) => {
            if target_pinned {
                return target != installed;
            }
            target > installed
        }
        _ => false,
    }
}

fn seed_system_module(
    ctx: &AppContext,
    id: &str,
    version: &str,
    entry: &VaultVersion,
) -> Result<()> {
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
    tracing::info!("staged system module {tag}");
    Ok(())
}

/// The checksum the registry recorded for `id@version`, if it carries that
/// version at all.
///
/// Callers that did not resolve the module themselves (the `spicetify://`
/// handler, and so anything in the client that reaches it) use this rather
/// than a checksum handed to them, so the bytes are held to what was
/// published rather than to whatever the caller claims they should hash to.
pub(crate) fn registry_checksum(
    config_root: &Path,
    identifier: &str,
    version: &str,
) -> Option<String> {
    let vault = cached_vault(config_root).ok()?;
    let entry = vault.modules.get(identifier)?.v.get(version)?;
    (!entry.checksum.is_empty()).then(|| entry.checksum.clone())
}

pub(crate) fn install(ctx: &AppContext, identifier: &str) -> Result<()> {
    let vault = cached_vault(&ctx.config_root)?;
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
    fn ranks_versions_by_semver_not_key_order() {
        let m = module("", &["1.7.0", "1.10.0", "1.2.0"]);
        assert_eq!(resolve_version(&m).expect("resolves"), "1.10.0");
    }

    #[test]
    fn stages_absent_and_outdated_store_managed_modules() {
        assert!(should_stage(false, None, "1.10.0", false), "absent is always seeded");
        assert!(should_stage(true, Some("1.5.2"), "1.10.0", false), "stale baseline refreshes");
    }

    #[test]
    fn leaves_current_and_developer_installs_alone() {
        assert!(!should_stage(true, Some("1.10.0"), "1.10.0", false), "current stays");
        assert!(
            !should_stage(true, Some("1.11.0"), "1.10.0", false),
            "ahead of the registry stays"
        );
        assert!(!should_stage(true, None, "1.10.0", false), "a real directory is a dev build");
        assert!(
            !should_stage(true, Some("not-semver"), "1.10.0", false),
            "garbage is not evidence"
        );
    }

    #[test]
    fn the_vault_cache_short_circuits_refreshes_and_falls_back() {
        use std::time::{Duration, SystemTime};
        let dir = std::env::temp_dir().join(format!("spicetify-vaultcache-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp dir");
        let path = dir.join("vault.json");
        let ttl = Duration::from_secs(300);
        let body = |id: &str| format!(r#"{{"modules":{{"{id}":{{"v":{{"1.0.0":{{}}}}}}}}}}"#);

        std::fs::write(&path, body("cached")).expect("seed cache");
        let now = SystemTime::now();

        let fresh = vault_via_cache(&path, ttl, now, || panic!("a fresh cache must not fetch"))
            .expect("served from cache");
        assert!(fresh.modules.contains_key("cached"));

        let later = now + Duration::from_secs(600);
        let refreshed =
            vault_via_cache(&path, ttl, later, || Ok(body("fetched"))).expect("refetched");
        assert!(refreshed.modules.contains_key("fetched"));
        assert!(
            std::fs::read_to_string(&path).expect("cache file").contains("fetched"),
            "a successful fetch rewrites the cache"
        );

        let offline = vault_via_cache(&path, ttl, later + Duration::from_secs(600), || {
            Err(anyhow::anyhow!("network down"))
        })
        .expect("stale fallback");
        assert!(offline.modules.contains_key("fetched"), "a failed fetch serves the stale copy");

        let missing = dir.join("absent.json");
        assert!(
            vault_via_cache(&missing, ttl, later, || Err(anyhow::anyhow!("network down"))).is_err(),
            "no cache and no network is an error"
        );

        std::fs::write(&path, "not json").expect("corrupt cache");
        let repaired = vault_via_cache(&path, ttl, SystemTime::now(), || Ok(body("repaired")))
            .expect("corrupt cache refetches even while fresh");
        assert!(repaired.modules.contains_key("repaired"));

        std::fs::remove_dir_all(&dir).expect("cleanup");
    }

    #[test]
    fn a_registry_pin_moves_the_install_in_either_direction() {
        assert!(should_stage(true, Some("1.10.1"), "1.10.0", true), "a pin is a rollback signal");
        assert!(!should_stage(true, Some("1.10.0"), "1.10.0", true), "already on the pin");
    }

    fn intent(enabled: Option<&str>, versions: &[(&str, bool)]) -> crate::module::vault::Module {
        crate::module::vault::Module {
            enabled: enabled.map(str::to_string),
            versions: versions
                .iter()
                .map(|(v, installed)| {
                    (
                        (*v).to_string(),
                        crate::module::Store {
                            installed: *installed,
                            artifacts: Vec::new(),
                            checksum: String::new(),
                        },
                    )
                })
                .collect(),
        }
    }

    #[test]
    fn honours_disable_and_hand_pins_but_not_deletion() {
        assert!(
            local_intent_blocks(&intent(None, &[("1.10.0", true)])),
            "disabled while installed stays off"
        );
        assert!(
            !local_intent_blocks(&intent(None, &[("1.10.0", false)])),
            "a deleted module is recovery, not intent"
        );
        assert!(
            local_intent_blocks(&intent(Some("1.7.0"), &[("1.7.0", true), ("1.10.0", true)])),
            "an enabled version below an installed newer one is a hand pin"
        );
        assert!(
            !local_intent_blocks(&intent(Some("1.10.0"), &[("1.10.0", true)])),
            "enabled at the newest installed version is the normal state"
        );
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
        let root = std::env::temp_dir().join(format!("spicetify-seed-live-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("temp config");

        let vault = cached_vault(&root).expect("registry reachable");
        let ctx = AppContext::from_config(root.clone(), &crate::context::Config::default())
            .expect("context");
        for id in SYSTEM_MODULES {
            let module = vault.modules.get(*id).expect("registry carries every system module");
            let version = resolve_version(module).expect("resolvable");
            let entry = module.v.get(&version).expect("resolved version has an entry");
            let result = seed_system_module(&ctx, id, &version, entry);
            assert!(result.is_ok(), "seed {id}: {:?}", result.err());
        }

        let modules_root = crate::module::modules_dir(&root);
        for id in SYSTEM_MODULES {
            let link = modules_root.join(id);
            assert!(link.exists(), "{id} enabled and reachable through modules/");
            assert!(link.join("metadata.json").is_file(), "{id} unpacked with its metadata");
        }
        let paths = crate::module::ModulePaths::from_config_root(&root);
        for id in SYSTEM_MODULES {
            assert!(
                store_managed_version(&paths.modules_root, &paths.store_root, id).is_some(),
                "{id} is store-managed after seeding"
            );
        }

        std::fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn recognises_store_managed_installs_by_their_resolved_path() {
        let dir = std::env::temp_dir().join(format!("spicetify-managed-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let modules = dir.join("modules");
        let store = dir.join("store");
        std::fs::create_dir_all(modules.join("manager")).expect("real dir");
        std::fs::create_dir_all(store.join("stdlib").join("1.10.0")).expect("store copy");
        std::fs::create_dir_all(store.join("store")).expect("store dir without an install");
        std::fs::create_dir_all(dir.join("dist").join("store@dev")).expect("dev build");
        crate::util::link::create_dir_link(
            &store.join("stdlib").join("1.10.0"),
            &modules.join("stdlib"),
        )
        .expect("store link");
        crate::util::link::create_dir_link(
            &dir.join("dist").join("store@dev"),
            &modules.join("store"),
        )
        .expect("dev link");

        assert_eq!(store_managed_version(&modules, &store, "stdlib").as_deref(), Some("1.10.0"));
        assert_eq!(
            store_managed_version(&modules, &store, "manager"),
            None,
            "a real directory is a developer's build"
        );
        assert_eq!(
            store_managed_version(&modules, &store, "store"),
            None,
            "a link outside the store tree is a developer's build"
        );
        assert_eq!(
            store_managed_version(&modules, &store, "bookmark"),
            None,
            "absent resolves to nothing"
        );

        std::fs::remove_dir_all(&dir).expect("cleanup");
    }
}
