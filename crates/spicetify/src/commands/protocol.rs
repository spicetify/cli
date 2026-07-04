use std::borrow::Cow;
use std::process::Command;

use url::Url;

use crate::context::AppContext;
use crate::error::{Result, http_error, wrap_error};
use crate::fl;
use crate::module::{self, ModulePaths, Store};

pub fn run(ctx: &AppContext, uri: &str) -> Result<()> {
    let response = handle(ctx, uri)?;
    if !response.is_empty() {
        let outbound = format!("spotify:app:rpc:{response}");
        launch_uri(&outbound)?;
    }
    Ok(())
}

pub fn handle(ctx: &AppContext, uri: &str) -> Result<String> {
    let u = Url::parse(uri).map_err(|_| http_error(400, fl!("proxy-invalid-url")))?;
    if u.scheme() != "spicetify" {
        return Err(http_error(400, fl!("unsupported-scheme")));
    }

    let opaque = u.path();
    let mut parts = opaque.split(':');
    let uuid = parts.next().unwrap_or_default();
    let action = parts.next().unwrap_or_default();

    let prefix = format!("spicetify:{uuid}:");
    let action = ProtocolAction::parse(action)
        .ok_or_else(|| http_error(502, fl!("protocol-error", err = "unknown action")))?;
    let result = perform(ctx, action, &u);

    let mut response = prefix;
    response.push(if result.is_ok() { '1' } else { '0' });
    result?;

    if uuid == "0" { Ok(String::new()) } else { Ok(response) }
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
            let checksum = get_param(&query, "checksum").unwrap_or_default();
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
            module::enable(&paths, &id)?;
            Ok(())
        }
        ProtocolAction::Delete => {
            let id = require_id(&query)?;
            module::delete(&paths, &id)?;
            Ok(())
        }
        ProtocolAction::Remove => {
            let id = require_id(&query)?;
            module::remove_store(&paths, &id)?;
            Ok(())
        }
        ProtocolAction::FastDelete | ProtocolAction::FastRemove => {
            let id = require_id(&query)?;
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
    }
}

fn require_id(query: &[(Cow<'_, str>, Cow<'_, str>)]) -> Result<module::vault::StoreIdentifier> {
    let raw = require_param(query, "id")?;
    module::vault::StoreIdentifier::parse(&raw).map_err(|e| http_error(400, e.to_string()))
}

fn require_param(query: &[(Cow<'_, str>, Cow<'_, str>)], key: &str) -> Result<String> {
    query
        .iter()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.to_string())
        .ok_or_else(|| http_error(400, format!("missing '{key}' query parameter")))
}

fn get_param(query: &[(Cow<'_, str>, Cow<'_, str>)], key: &str) -> Option<String> {
    query.iter().find(|(k, _)| k == key).map(|(_, v)| v.to_string())
}

fn get_all_params(query: &[(Cow<'_, str>, Cow<'_, str>)], key: &str) -> Vec<String> {
    query.iter().filter(|(k, _)| k == key).map(|(_, v)| v.to_string()).collect()
}

fn launch_uri(uri: &str) -> Result<()> {
    let result = if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/c", "start", uri]).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(uri).spawn()
    } else {
        Command::new("xdg-open").arg(uri).spawn()
    };

    let uri = uri.to_string();
    let child =
        result.map_err(|e| wrap_error(anyhow::anyhow!("failed to open URI '{uri}': {e}"), 502))?;
    drop(child);
    Ok(())
}
