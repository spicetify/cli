// `path` and `support`: the read-only commands people paste into bug reports.

use crate::context::AppContext;
use crate::error::Result;

/// Who patched the client, inferred from the same artifacts apply and
/// restore move around: v3 keeps `xpui.spa.backup`; v2 (or another tool)
/// leaves an extracted `xpui/` with no archive at all.
fn applied(ctx: &AppContext) -> &'static str {
    let apps = ctx.spotify_apps_path();
    if ctx.mirror {
        return if ctx.config_root.join("apps").is_dir() { "v3 (mirror)" } else { "no" };
    }
    if apps.join("xpui.spa.backup").is_file() {
        "v3"
    } else if apps.join("xpui").is_dir() && !apps.join("xpui.spa").is_file() {
        "Spicetify v2 or another tool"
    } else {
        "no"
    }
}

#[allow(clippy::unnecessary_wraps)]
pub(crate) fn path(ctx: &AppContext) -> Result<()> {
    for (label, value) in [
        ("config root", ctx.config_root.clone()),
        ("config file", ctx.config_file.clone()),
        ("modules", crate::module::modules_dir(&ctx.config_root)),
        ("hooks", ctx.config_root.join("hooks")),
        ("spotify apps", ctx.spotify_apps_path()),
        ("applied client", ctx.dest_apps_path().join("xpui")),
    ] {
        tracing::info!("{label}: {}", value.display());
    }
    Ok(())
}

#[allow(clippy::unnecessary_wraps)]
pub(crate) fn support(ctx: &AppContext) -> Result<()> {
    let version = crate::hooks::version_detect::detect_spotify_version(ctx)
        .map_or_else(|_| "unknown".to_string(), |v| v.to_string());
    let classmap = crate::module::stage::classmap_key_for_version(&version)
        .unwrap_or_else(|| "unknown".to_string());
    let staged = std::fs::read_dir(ctx.dest_apps_path().join("xpui").join("modules"))
        .map(|d| d.filter_map(std::result::Result::ok).filter(|e| e.path().is_dir()).count())
        .unwrap_or_default();
    let blocked =
        super::updates::is_blocked(ctx).map_or_else(|_| "unknown".to_string(), |b| b.to_string());

    tracing::info!("cli: {} (rust)", env!("CARGO_PKG_VERSION"));
    tracing::info!("spotify: {version}");
    tracing::info!("classmap key: {classmap}");
    tracing::info!("applied: {}", applied(ctx));
    if let Some(backup) = crate::legacy::find_backup() {
        tracing::info!(
            "v2 backup: {} (Spotify {})",
            backup.dir.display(),
            backup.spotify_version.as_deref().unwrap_or("unknown")
        );
    } else {
        tracing::info!("v2 backup: none");
    }
    tracing::info!(
        "v2 files in config root: {}",
        if crate::legacy::has_v2_archive(&ctx.config_root) { "yes" } else { "no" }
    );
    tracing::info!("css map: {}", crate::module::cssmap::source(&ctx.config_root));
    tracing::info!("staged modules: {staged}");
    tracing::info!("updates blocked: {blocked}");
    tracing::info!("config root: {}", ctx.config_root.display());
    tracing::info!("spotify apps: {}", ctx.spotify_apps_path().display());
    Ok(())
}
