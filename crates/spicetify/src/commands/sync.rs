use crate::context::AppContext;
use crate::error::{Result, wrap_error};
use crate::{fl, util};

pub(crate) fn run(ctx: &AppContext) -> Result<()> {
    // TODO: let the user choose which release to install and surface
    let bytes = reqwest::blocking::get(
        "https://github.com/veryboringhwl/hooks/releases/latest/download/hooks.tar.zst",
    )
    .map_err(|e| wrap_error(anyhow::anyhow!("{}", fl!("proxy-request-failed")).context(e), 502))?
    .bytes()
    .map_err(|e| wrap_error(anyhow::anyhow!("{}", fl!("proxy-request-failed")).context(e), 502))?;

    let hooks = ctx.config_root.join("hooks");
    if let Err(e) = std::fs::remove_dir_all(&hooks)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(error = %e, path = %hooks.display(), "failed to remove directory");
    }
    util::untar_zst_bytes(&bytes, &hooks)?;
    Ok(())
}
