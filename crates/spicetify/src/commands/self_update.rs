use anyhow::Context;

use crate::error::Result;
use crate::{fl, update};

pub(crate) fn run() -> Result<()> {
    let current_version = crate::VERSION;
    tracing::info!("{}", fl!("self-update-checking"));

    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .context("failed to create async runtime")?;

    let release = rt.block_on(async { update::check_for_update().await })?;

    let Some(release) = release else {
        tracing::info!("{}", fl!("self-update-up-to-date", version = current_version));
        return Ok(());
    };

    tracing::info!(
        "{}",
        fl!("self-update-downloading", version = release.version(), current = current_version)
    );

    rt.block_on(async {
        let staged = update::download_update(&release, |downloaded, total| {
            if total > 0 {
                tracing::info!(downloaded, total, "downloading...");
            }
        })
        .await?;
        update::install_update(&staged)
    })
}
