use crate::context::{AppContext, Config};
use crate::error::Result;
use crate::fl;
use crate::module::{self, ModulePaths};

pub(crate) fn run(ctx: &AppContext) -> Result<()> {
    if !ctx.config_file.exists() {
        let cfg = Config {
            mirror: ctx.mirror,
            spotify_data_dir: Some(ctx.spotify_data_dir.clone()),
            spotify_exec: Some(ctx.spotify_exec.clone()),
            offline_bnk_dir: Some(ctx.offline_bnk_dir.clone()),
        };
        cfg.save(&ctx.config_file)?;
    }

    for folder in ["hooks", "modules", "store"] {
        if let Err(e) = std::fs::remove_dir_all(ctx.config_root.join(folder))
            && e.kind() != std::io::ErrorKind::NotFound
        {
            tracing::warn!(error = %e, path = %ctx.config_root.join(folder).display(), "failed to remove directory");
        }
    }

    let paths = ModulePaths::from_config_root(&ctx.config_root);
    module::initialize(&paths)?;

    tracing::info!("{}", fl!("initialised-spicetify"));
    Ok(())
}
