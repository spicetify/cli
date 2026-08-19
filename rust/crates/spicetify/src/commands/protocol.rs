use std::borrow::Cow;

use url::Url;

use crate::context::AppContext;
use crate::error::Result;
use crate::fl;
use crate::module::{self, ModulePaths, Store};

pub(crate) fn run(ctx: &AppContext, uri: &str) -> Result<()> {
    let response = handle(ctx, uri)?;
    if !response.is_empty() {
        let outbound = format!("spotify:app:rpc:{response}");
        launch_uri(&outbound)?;
    }
    Ok(())
}

pub fn handle(ctx: &AppContext, uri: &str) -> Result<String> {
    let u = Url::parse(uri).map_err(|_| anyhow::anyhow!(fl!("proxy-invalid-url")))?;
    if u.scheme() != "spicetify" {
        return Err(anyhow::anyhow!(fl!("unsupported-scheme")));
    }

    let opaque = u.path();
    let mut parts = opaque.split(':');
    let module_id = parts.next().unwrap_or_default();
    let action = parts.next().unwrap_or_default();

    let prefix = format!("spicetify:{module_id}:");
    let action = ProtocolAction::parse(action)
        .ok_or_else(|| anyhow::anyhow!(fl!("protocol-error", err = "unknown action")))?;
    perform(ctx, action, &u)?;

    if module_id == "0" {
        return Ok(String::new());
    }
    let mut response = prefix;
    response.push('1');
    Ok(response)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ProtocolAction {
    Add,
    FastInstall,
    FastEnable,
    Install,
    Enable,
    Delete,
    Remove,
    FastDelete,
    FastRemove,
    Apply,
    BlockUpdates,
    UnblockUpdates,
}

impl ProtocolAction {
    fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "add" => Self::Add,
            "fast-install" => Self::FastInstall,
            "fast-enable" => Self::FastEnable,
            "install" => Self::Install,
            "enable" => Self::Enable,
            "delete" => Self::Delete,
            "remove" => Self::Remove,
            "fast-delete" => Self::FastDelete,
            "fast-remove" => Self::FastRemove,
            "apply" => Self::Apply,
            "block-updates" => Self::BlockUpdates,
            "unblock-updates" => Self::UnblockUpdates,
            _ => return None,
        })
    }
}

fn perform(ctx: &AppContext, action: ProtocolAction, uri: &Url) -> Result<()> {
    let paths = ModulePaths::from_config_root(&ctx.config_root);
    let query: Vec<_> = uri.query_pairs().collect();

    match action {
        ProtocolAction::Add | ProtocolAction::FastInstall | ProtocolAction::FastEnable => {
            let id = require_id(&query)?;
            let artifacts = get_all_params(&query, "artifacts");
            // The checksum comes from the registry, never from the caller.
            // Anything that can reach this handler (page JS through
            // Spicetify.Daemon, a spicetify:// link) could otherwise supply
            // the hash of its own bytes and have them verified against
            // themselves, which is no verification at all.
            let checksum =
                crate::commands::pkg::registry_checksum(&id.module_identifier, &id.version)
                    .unwrap_or_default();
            if checksum.is_empty() {
                // For any other module this degrades to an unverified
                // install with a warning; for the store, an unverified
                // replacement is an uninstall with extra steps, so it is
                // refused outright.
                if id.module_identifier == "store" {
                    return Err(anyhow::anyhow!(fl!(
                        "protocol-error",
                        err = "the store can only be installed from a registry-verified artifact"
                    )));
                }
                tracing::warn!(
                    "{id}: not in the registry, so there is no checksum to verify these bytes against"
                );
            }
            module::add_store(&paths, &id, Store { installed: false, artifacts, checksum })?;
            if matches!(action, ProtocolAction::Add) {
                return Ok(());
            }
            module::install(&paths, &id)?;
            if matches!(action, ProtocolAction::FastInstall) {
                return Ok(());
            }
            module::enable(&paths, &id)?;
            Ok(())
        }
        ProtocolAction::Install => {
            let id = require_id(&query)?;
            module::install(&paths, &id)?;
            Ok(())
        }
        ProtocolAction::Enable => {
            let id = module::parse_enable_id(&require_param(&query, "id")?)?;
            // An empty version is the disable spelling: it drops the enable
            // link, which for the store is an uninstall by another name.
            if id.version.is_empty() {
                refuse_store_removal(&id)?;
            }
            module::enable(&paths, &id)?;
            Ok(())
        }
        ProtocolAction::Delete => {
            let id = require_id(&query)?;
            refuse_store_removal(&id)?;
            module::delete(&paths, &id)?;
            Ok(())
        }
        ProtocolAction::Remove => {
            let id = require_id(&query)?;
            refuse_store_removal(&id)?;
            module::remove_store(&paths, &id)?;
            Ok(())
        }
        ProtocolAction::FastDelete | ProtocolAction::FastRemove => {
            let id = require_id(&query)?;
            refuse_store_removal(&id)?;
            let disable_id = module::vault::StoreIdentifier {
                module_identifier: id.module_identifier.clone(),
                version: String::new(),
            };
            module::enable(&paths, &disable_id)?;
            module::delete(&paths, &id)?;
            if matches!(action, ProtocolAction::FastRemove) {
                module::remove_store(&paths, &id)?;
            }
            Ok(())
        }
        // apply stops and relaunches the client, so a caller inside it is
        // killed before any reply reaches it. That is expected: treat it as
        // fire-and-forget rather than waiting on a response.
        ProtocolAction::Apply => super::apply::run(ctx),
        ProtocolAction::BlockUpdates => set_updates_blocked(ctx, true),
        ProtocolAction::UnblockUpdates => set_updates_blocked(ctx, false),
    }
}

/// Changing the update policy patches Spotify's binary, which means stopping
/// the client; `set_blocked` leaves it stopped because a terminal caller
/// relaunches it themselves. A caller inside the client cannot, so bring it
/// back rather than having the user's Spotify vanish on a button press. A
/// no-op change never stops it, so only relaunch what was actually running.
fn set_updates_blocked(ctx: &AppContext, block: bool) -> Result<()> {
    let was_running = crate::lifecycle::is_running(ctx);
    super::updates::set_blocked(ctx, block)?;
    if was_running && !crate::lifecycle::is_running(ctx) {
        crate::lifecycle::start(ctx)?;
    }
    Ok(())
}

/// The store is the client's recovery surface: with it gone nothing can be
/// reinstalled from inside the client, so protocol callers (page JS through
/// the daemon socket, a `spicetify://` link) can never delete it. The
/// terminal commands stay able to, as does deleting files by hand.
fn refuse_store_removal(id: &module::vault::StoreIdentifier) -> Result<()> {
    if id.module_identifier == "store" {
        return Err(anyhow::anyhow!(fl!(
            "protocol-error",
            err = "the store cannot be uninstalled"
        )));
    }
    Ok(())
}

fn require_id(query: &[(Cow<'_, str>, Cow<'_, str>)]) -> Result<module::vault::StoreIdentifier> {
    let raw = require_param(query, "id")?;
    Ok(module::vault::StoreIdentifier::parse(&raw)?)
}

fn require_param(query: &[(Cow<'_, str>, Cow<'_, str>)], key: &str) -> Result<String> {
    query
        .iter()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.to_string())
        .ok_or_else(|| anyhow::anyhow!("missing '{key}' query parameter"))
}

fn get_all_params(query: &[(Cow<'_, str>, Cow<'_, str>)], key: &str) -> Vec<String> {
    query.iter().filter(|(k, _)| k == key).map(|(_, v)| v.to_string()).collect()
}

fn launch_uri(uri: &str) -> Result<()> {
    opener::open(uri).map_err(|e| anyhow::anyhow!("failed to open URI '{uri}': {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn id(module: &str, version: &str) -> module::vault::StoreIdentifier {
        module::vault::StoreIdentifier {
            module_identifier: module.to_string(),
            version: version.to_string(),
        }
    }

    #[test]
    fn refuses_removing_the_store_at_any_version() {
        assert!(refuse_store_removal(&id("store", "1.6.1")).is_err());
        assert!(refuse_store_removal(&id("store", "")).is_err());
    }

    #[test]
    fn matches_the_store_id_exactly() {
        assert!(refuse_store_removal(&id("bookmark", "0.4.0")).is_ok());
        assert!(refuse_store_removal(&id("someone/store", "1.0.0")).is_ok());
        assert!(refuse_store_removal(&id("store-theme", "1.0.0")).is_ok());
    }
}
