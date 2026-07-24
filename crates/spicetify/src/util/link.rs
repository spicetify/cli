use std::path::Path;

use crate::error::Result;

pub(crate) fn create_dir_link(target: &Path, link: &Path) -> Result<()> {
    if let Some(parent) = link.parent() {
        std::fs::create_dir_all(parent)?;
    }
    if link.exists() {
        remove_link(link)?;
    }
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(target, link)?;
        Ok(())
    }
    #[cfg(windows)]
    {
        std::os::windows::fs::junction_point(target, link)
            .map_err(|e| anyhow::anyhow!("junction create failed: {e}"))?;
        Ok(())
    }
}

#[cfg(windows)]
fn remove_link(link: &Path) -> Result<()> {
    if let Err(e) = std::fs::remove_dir(link)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        return Err(anyhow::anyhow!("junction delete failed: {e}"));
    }
    Ok(())
}

#[cfg(not(windows))]
fn remove_link(link: &Path) -> Result<()> {
    match std::fs::remove_file(link) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::IsADirectory => {
            std::fs::remove_dir_all(link).map_err(Into::into)
        }
        Err(e) => Err(e.into()),
    }
}
