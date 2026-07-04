use crate::context::AppContext;
use crate::fl;

pub(crate) fn run(ctx: &AppContext) {
    tracing::info!("{}", fl!("config-mirror", value = if ctx.mirror { "true" } else { "false" }));
    tracing::info!("{}", fl!("config-file", path = ctx.config_file.to_string_lossy()));
    tracing::info!("{}", fl!("config-root", path = ctx.config_root.to_string_lossy()));
    tracing::info!(
        "{}",
        fl!("config-spotify-data-path", path = ctx.spotify_data_path.to_string_lossy())
    );
    tracing::info!(
        "{}",
        fl!("config-spotify-exec-path", path = ctx.spotify_exec_path.to_string_lossy())
    );
    tracing::info!(
        "{}",
        fl!("config-offline-bnk-dir", path = ctx.offline_bnk_dir.to_string_lossy())
    );
}
