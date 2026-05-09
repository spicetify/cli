use anyhow::Result;

use crate::{config::AppContext, logging};

pub fn run(ctx: &AppContext) -> Result<()> {
    logging::info(&format!("daemon: {}", ctx.daemon));
    logging::info(&format!("mirror: {}", ctx.mirror));
    logging::info(&format!("config file: {}", ctx.config_file.display()));
    logging::info(&format!("config root: {}", ctx.config_root.display()));
    logging::info(&format!(
        "Spotify data path: {}",
        ctx.spotify_data_path.display()
    ));
    logging::info(&format!(
        "Spotify exec path: {}",
        ctx.spotify_exec_path.display()
    ));
    logging::info(&format!(
        "Spotify config path: {}",
        ctx.spotify_config_path.display()
    ));
    Ok(())
}
