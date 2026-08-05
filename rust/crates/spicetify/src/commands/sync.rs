use super::SyncTarget;
use crate::context::AppContext;
use crate::error::Result;
use crate::{fl, hooks, util};

pub(crate) fn run(ctx: &AppContext, target: &SyncTarget) -> Result<()> {
    if let SyncTarget::Local(dir) = target {
        return sync_local(ctx, dir);
    }
    let url = match target {
        SyncTarget::Local(_) => unreachable!("handled above"),
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

            let set = resolved.best_match().expect("matching is non-empty");
            tracing::info!("using hook set v{} ({})", set.hooks_version, set.display_label());
            set.download_url
        }
        SyncTarget::Url(url) => url.clone(),
    };

    let client = hooks::blocking_client();
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

// Staging a payload straight from disk skips the manifest's version matching
// and integrity checks, so it validates the directory shape itself and is only
// reachable from an explicit `--local`.
fn sync_local(ctx: &AppContext, dir: &std::path::Path) -> Result<()> {
    if !dir.is_dir() {
        anyhow::bail!("local payload {} is not a directory", dir.display());
    }
    for required in ["spicetifyWrapper.js", "modularLoader.js"] {
        if !dir.join(required).is_file() {
            anyhow::bail!(
                "local payload {} is missing {required} (build it with `pnpm build:payload`)",
                dir.display()
            );
        }
    }

    let hooks = ctx.config_root.join("hooks");
    if let Err(e) = std::fs::remove_dir_all(&hooks)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        tracing::warn!(error = %e, path = %hooks.display(), "failed to remove directory");
    }
    std::fs::create_dir_all(&hooks)?;

    let mut staged = 0usize;
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        std::fs::copy(entry.path(), hooks.join(entry.file_name())).map(|_| ())?;
        staged += 1;
    }

    // Apply prefers the payload embedded in the binary; this marker is what
    // makes it defer to the directory instead.
    std::fs::write(hooks.join(crate::payload::LOCAL_MARKER), b"")?;

    tracing::warn!("staged {staged} file(s) from a local payload: unversioned and unverified");
    tracing::info!("{}", fl!("hooks-updated"));
    Ok(())
}
