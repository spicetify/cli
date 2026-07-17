use crate::context::AppContext;
use crate::error::Result;
use crate::{fl, util};

pub(crate) fn run(ctx: &AppContext) -> Result<()> {
    // TODO: let the user choose which release to install and surface
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| anyhow::anyhow!("failed to create HTTP client: {e}"))?;
    let bytes = client
        .get("https://github.com/veryboringhwl/hooks/releases/latest/download/hooks.tar.zst")
        .send()
        .map_err(|e| anyhow::anyhow!("{}", fl!("proxy-request-failed")).context(e))?
        .bytes()
        .map_err(|e| anyhow::anyhow!("{}", fl!("proxy-request-failed")).context(e))?;

    let hooks = ctx.config_root.join("hooks");
    if let Err(e) = std::fs::remove_dir_all(&hooks)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(error = %e, path = %hooks.display(), "failed to remove directory");
    }
    util::untar_zst_bytes(&bytes, &hooks)?;

    tracing::info!("{}", fl!("hooks-updated"));
    Ok(())
}
