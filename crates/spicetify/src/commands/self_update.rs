use anyhow::Context;

use crate::error::Result;
use crate::{fl, update};

pub(crate) fn run() -> Result<()> {
    let current_version = crate::VERSION;
    tracing::info!("{}", fl!("self-update-checking"));

    let release = match update::check_for_update() {
        Ok(Some(r)) => r,
        Ok(None) => {
            tracing::info!("{}", fl!("self-update-up-to-date", version = current_version));
            return Ok(());
        }
        Err(e) => {
            return Err(e).context(fl!("failed-check-updates"));
        }
    };

    tracing::info!(
        "{}",
        fl!("self-update-downloading", version = release.version(), current = current_version)
    );
    update::download_and_install(&release)
}
