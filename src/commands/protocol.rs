// TODO: register spicetify:// URI
// Go's README.md:69 lists "register uri scheme and daemon/task" as a TODO. On Windows this
// means writing registry keys (HKEY_CLASSES_ROOT\spicetify\shell\open\command) pointing to the
// spicetify binary. On macOS it's a LaunchServices/CFBundleURLSchemes entry. On Linux it's a
// .desktop file with x-scheme-handler/spicetify MIME type. Without this, spicetify:// URIs from
// the marketplace UI won't trigger the protocol handler automatically.

use std::process::Command;

use anyhow::{Result, bail};
use url::Url;

use crate::{
    config::AppContext, module::{self, ModulePaths, Store}
};

pub fn run(ctx: &AppContext, uri: &str) -> Result<()> {
    let response = handle(ctx, uri)?;
    if !response.is_empty() {
        let outbound = format!("spotify:app:rpc:{}", response);
        launch_uri(&outbound)?;
    }
    Ok(())
}

pub fn handle(ctx: &AppContext, uri: &str) -> Result<String> {
    let u = Url::parse(uri)?;
    if u.scheme() != "spicetify" {
        bail!("unsupported scheme")
    }

    let opaque = u.path();
    let mut parts = opaque.split(':');
    let uuid = parts.next().unwrap_or_default();
    let action = parts.next().unwrap_or_default();

    let prefix = format!("spicetify:{}:", uuid);
    let result = perform(ctx, action, &u);

    let mut response = prefix;
    response.push(if result.is_ok() { '1' } else { '0' });
    result?;

    if uuid == "0" {
        Ok(String::new())
    } else {
        Ok(response)
    }
}

fn perform(ctx: &AppContext, action: &str, uri: &Url) -> Result<()> {
    let paths = ModulePaths::from_config_root(&ctx.config_root);
    let query: Vec<_> = uri.query_pairs().collect();

    let get = |key: &str| -> Option<String> {
        query
            .iter()
            .find(|(k, _)| k == key)
            .map(|(_, v)| v.to_string())
    };
    let get_all = |key: &str| -> Vec<String> {
        query
            .iter()
            .filter(|(k, _)| k == key)
            .map(|(_, v)| v.to_string())
            .collect()
    };

    match action {
        "add" | "fast-install" | "fast-enable" => {
            let id = module::vault::StoreIdentifier::parse(&get("id").unwrap_or_default())?;
            let artifacts = get_all("artifacts");
            let checksum = get("checksum").unwrap_or_default();

            module::add_store(
                &paths,
                &id,
                Store {
                    installed: false,
                    artifacts,
                    checksum,
                },
            )?;

            if action == "add" {
                return Ok(());
            }
            module::install(&paths, &id)?;
            if action == "fast-install" {
                return Ok(());
            }
            module::enable(&paths, &id)
        }
        "install" => {
            let id = module::vault::StoreIdentifier::parse(&get("id").unwrap_or_default())?;
            module::install(&paths, &id)
        }
        "enable" => {
            let id = module::parse_enable_id(&get("id").unwrap_or_default())?;
            module::enable(&paths, &id)
        }
        "delete" => {
            let id = module::vault::StoreIdentifier::parse(&get("id").unwrap_or_default())?;
            module::delete(&paths, &id)
        }
        "remove" => {
            let id = module::vault::StoreIdentifier::parse(&get("id").unwrap_or_default())?;
            module::remove_store(&paths, &id)
        }
        "fast-delete" | "fast-remove" => {
            let id = module::vault::StoreIdentifier::parse(&get("id").unwrap_or_default())?;
            let disable_id = module::vault::StoreIdentifier {
                module_identifier: id.module_identifier.clone(),
                version: String::new(),
            };
            module::enable(&paths, &disable_id)?;
            module::delete(&paths, &id)?;
            if action == "fast-remove" {
                module::remove_store(&paths, &id)?;
            }
            Ok(())
        }
        _ => bail!("this operation is not supported"),
    }
}

fn launch_uri(uri: &str) -> Result<()> {
    let result = if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/c", "start", uri]).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(uri).spawn()
    } else {
        Command::new("xdg-open").arg(uri).spawn()
    };

    result
        .map(|_| ())
        .map_err(|e| anyhow::anyhow!("failed to open URI {uri}: {e}"))
}
