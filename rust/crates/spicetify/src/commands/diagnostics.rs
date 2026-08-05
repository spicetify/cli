// `path` and `support`: the read-only commands people paste into bug reports.

use crate::context::AppContext;
use crate::error::Result;

/// Whether the client currently carries an apply, inferred from the same
/// artifacts apply/restore move around.
fn applied(ctx: &AppContext) -> bool {
    ctx.dest_apps_path().join("xpui").is_dir()
        && !ctx.spotify_apps_path().join("xpui.spa").is_file()
}

#[allow(clippy::unnecessary_wraps)]
pub(crate) fn path(ctx: &AppContext) -> Result<()> {
    for (label, value) in [
        ("config root", ctx.config_root.clone()),
        ("config file", ctx.config_file.clone()),
        ("modules", ctx.config_root.join("Modules")),
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
    let blocked = super::updates::is_blocked(ctx)
        .map_or_else(|_| "unknown".to_string(), |b| b.to_string());

    tracing::info!("cli: {} (rust)", env!("CARGO_PKG_VERSION"));
    tracing::info!("spotify: {version}");
    tracing::info!("classmap key: {classmap}");
    tracing::info!("applied: {}", applied(ctx));
    tracing::info!("staged modules: {staged}");
    tracing::info!("updates blocked: {blocked}");
    tracing::info!("config root: {}", ctx.config_root.display());
    tracing::info!("spotify apps: {}", ctx.spotify_apps_path().display());
    Ok(())
}
