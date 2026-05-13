use std::path::PathBuf;

use anyhow::Result;

use crate::{
    config::AppContext, module::{self, ModulePaths, Store}
};

pub fn install(ctx: &AppContext, id_str: &str, url: &str) -> Result<()> {
    let id = module::vault::StoreIdentifier::parse(id_str)?;
    let paths = ModulePaths::from_config_root(&ctx.config_root);

    let normalized = normalize_url(url)?;
    module::add_store(
        &paths,
        &id,
        Store {
            installed: false,
            artifacts: vec![normalized],
            checksum: String::new(),
        },
    )?;
    module::install(&paths, &id)
}

pub fn delete(ctx: &AppContext, id_str: &str) -> Result<()> {
    let id = module::vault::StoreIdentifier::parse(id_str)?;
    let paths = ModulePaths::from_config_root(&ctx.config_root);
    module::delete(&paths, &id)?;
    module::remove_store(&paths, &id)
}

pub fn enable(ctx: &AppContext, id_str: &str) -> Result<()> {
    let id = module::vault::StoreIdentifier::parse(id_str)?;
    let paths = ModulePaths::from_config_root(&ctx.config_root);
    module::enable(&paths, &id)
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
