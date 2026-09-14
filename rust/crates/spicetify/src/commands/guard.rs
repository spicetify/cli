use std::path::Path;

use crate::error::Result;

const LOCK_FILE: &str = "spicetify-disruptive-operation.lock";

/// Serializes operations that stop Spotify or rewrite its application bundle.
/// The update transaction keeps this guard for its whole lifetime; ordinary
/// apply/block commands fail fast instead of racing it across processes.
#[derive(Debug)]
pub struct DisruptiveOperationGuard {
    _file: std::fs::File,
}

pub fn try_acquire(config_root: &Path) -> Result<DisruptiveOperationGuard> {
    std::fs::create_dir_all(config_root)?;
    let path = config_root.join(LOCK_FILE);
    let file = std::fs::OpenOptions::new().create(true).truncate(false).write(true).open(&path)?;
    fs4::FileExt::try_lock(&file).map_err(|e| {
        anyhow::anyhow!(
            "another Spotify update or apply operation is already in progress at {}: {e}",
            path.display()
        )
    })?;
    Ok(DisruptiveOperationGuard { _file: file })
}
