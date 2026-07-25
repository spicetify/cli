use super::SyncTarget;
use crate::context::AppContext;
use crate::error::Result;
use crate::{fl, hooks, util};

pub(crate) fn run(ctx: &AppContext, target: &SyncTarget) -> Result<()> {
    let url = match target {
        SyncTarget::Auto => {
            let sets = hooks::manifest::fetch_hook_sets()
                .map_err(|e| anyhow::anyhow!("failed to fetch available hook sets: {e}"))?;
            if sets.is_empty() {
                anyhow::bail!("no hook sets available");
            }
            let resolved = hooks::resolve_hook_sets(sets, ctx);

            if let Some(ref version) = resolved.spotify_version {
                tracing::info!("detected Spotify {version}");
            } else {
                tracing::warn!("unable to detect Spotify version");
            }

            if resolved.matching.is_empty() {
                let version = resolved
                    .spotify_version
                    .map_or_else(|| "unknown".to_string(), |v| v.to_string());
                anyhow::bail!("no hook set supports Spotify {version}");
            }

            let mut matching = resolved.matching;
            matching.sort_by(|a, b| {
                let va = semver::Version::parse(&a.hooks_version).ok();
                let vb = semver::Version::parse(&b.hooks_version).ok();
                vb.cmp(&va)
            });
            let set = matching.first().expect("matching is non-empty");
            tracing::info!("using hook set v{} ({})", set.hooks_version, set.display_label());
            set.download_url.clone()
        }
        SyncTarget::Url(url) => url.clone(),
    };

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| anyhow::anyhow!("failed to create HTTP client: {e}"))?;
    let bytes = client
        .get(&url)
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
