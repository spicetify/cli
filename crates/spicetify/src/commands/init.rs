use anyhow::Result;

use crate::{
    config::{AppContext, Config}, i18n, logging, module::{self, ModulePaths}
};

pub fn run(ctx: &AppContext) -> Result<()> {
    if !ctx.config_file.exists() {
        let cfg = Config {
            daemon: ctx.daemon,
            mirror: ctx.mirror,
            spotify_data_path: Some(ctx.spotify_data_path.clone()),
            spotify_exec_path: Some(ctx.spotify_exec_path.clone()),
            spotify_config_path: Some(ctx.spotify_config_path.clone()),
        };
        Config::save(&ctx.config_file, &cfg)?;
    }

    for folder in ["hooks", "modules", "store"] {
        let path = ctx.config_root.join(folder);
        let _ = std::fs::remove_dir_all(&path);
    }

    let paths = ModulePaths::from_config_root(&ctx.config_root);
    module::initialize(&paths)?;
    logging::info(i18n::lookup("initialized_spicetify"));
    Ok(())
}
