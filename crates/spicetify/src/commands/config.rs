use anyhow::Result;

use crate::{config::AppContext, i18n, logging};

pub fn run(ctx: &AppContext) -> Result<()> {
    logging::info(i18n::lookup_with_args(
        "config_daemon",
        &[("value", &ctx.daemon.to_string())],
    ));
    logging::info(i18n::lookup_with_args(
        "config_mirror",
        &[("value", &ctx.mirror.to_string())],
    ));
    logging::info(i18n::lookup_with_args(
        "config_file",
        &[("path", &ctx.config_file.display().to_string())],
    ));
    logging::info(i18n::lookup_with_args(
        "config_root",
        &[("path", &ctx.config_root.display().to_string())],
    ));
    logging::info(i18n::lookup_with_args(
        "config_spotify_data_path",
        &[("path", &ctx.spotify_data_path.display().to_string())],
    ));
    logging::info(i18n::lookup_with_args(
        "config_spotify_exec_path",
        &[("path", &ctx.spotify_exec_path.display().to_string())],
    ));
    logging::info(i18n::lookup_with_args(
        "config_spotify_config_path",
        &[("path", &ctx.spotify_config_path.display().to_string())],
    ));
    Ok(())
}
