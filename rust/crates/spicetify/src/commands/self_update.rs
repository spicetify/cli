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

    rt.block_on(async {
        let staged = update::download_update(&release, arch, |downloaded, total| {
            if total > 0 {
                tracing::info!(downloaded, total, "downloading...");
            }
        })
        .await?;
        update::install_update(&staged)
    })
}
