use crate::context::AppContext;
use crate::error::Result;
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

pub(crate) fn open_folder(ctx: &AppContext) -> Result<()> {
    let path = &ctx.config_root;
    opener::open(path).map_err(|e| {
        tracing::error!("{}", fl!("config-open-folder-failed", err = e.to_string()));
        anyhow::anyhow!("failed to open config folder: {e}")
    })?;
    tracing::info!("{}", fl!("config-open-folder", path = path.to_string_lossy()));
    Ok(())
}
