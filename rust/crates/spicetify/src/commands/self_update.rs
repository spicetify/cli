use anyhow::Context;

use crate::error::Result;
use crate::{fl, update};

pub(crate) fn run(ctx: &crate::context::AppContext) -> Result<()> {
    let current_version = crate::VERSION;
    let arch = update::release::platform_arch(ctx);
    tracing::info!("{}", fl!("self-update-checking"));

    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .context("failed to create async runtime")?;

    let release = rt.block_on(async { update::check_for_update(arch).await })?;

    let Some(release) = release else {
        #[cfg(windows)]
        if crate::daemon::DaemonManager::create().is_installed()
            && !crate::daemon::is_daemon_running()
        {
            crate::daemon::process::spawn()
                .context("failed to restart enabled daemon after update")?;
        }
        tracing::info!("{}", fl!("self-update-up-to-date", version = current_version));
        return Ok(());
    };

    tracing::info!(
        "{}",
        fl!("self-update-downloading", version = release.version(), current = current_version)
    );

    let staged = rt.block_on(update::download_update(&release, arch, |downloaded, total| {
        if total > 0 {
            tracing::info!(downloaded, total, "downloading...");
        }
    }))?;
    // Installation runs outside the runtime: stopping the daemon uses a
    // blocking HTTP client, which panics inside an async context.
    drop(rt);
    update::install_update(&staged)
}

/// Turns the daemon's automatic updates on or off in config.toml.
pub(crate) fn set_auto(ctx: &crate::context::AppContext, on: bool) -> Result<()> {
    let mut cfg = crate::context::Config::load(&ctx.config_file)?;
    cfg.auto_update = on;
    cfg.save(&ctx.config_file)?;
    tracing::info!(
        "automatic updates {}",
        if on { "on: the daemon installs new releases daily" } else { "off" }
    );
    auto_status(&crate::context::AppContext { auto_update: on, ..ctx.clone() });
    Ok(())
}

pub(crate) fn auto_status(ctx: &crate::context::AppContext) {
    if !ctx.auto_update {
        tracing::info!("automatic updates are off; run `spicetify auto-update on` to turn them on");
        return;
    }
    match update::official_install_dir() {
        Some(dir) if update::is_official_install(&dir) => {
            tracing::info!("automatic updates are on");
        }
        Some(dir) => tracing::info!(
            "automatic updates are on, but only an install in {} updates itself",
            dir.display()
        ),
        None => tracing::info!("automatic updates are on"),
    }
}
