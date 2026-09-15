use std::path::Path;

use crate::error::Result;

const LOCK_FILE: &str = "spicetify-disruptive-operation.lock";

/// Serializes Spotify lifecycle and package/configuration mutations. Hold this
/// across path validation and filesystem access so another package operation
/// cannot replace a checked directory with a link. The update transaction keeps
/// it for its whole lifetime; competing commands fail fast across processes.
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
            "another Spotify update, apply, or package operation is already in progress at {}: {e}",
            path.display()
        )
    })?;
    Ok(DisruptiveOperationGuard { _file: file })
}
