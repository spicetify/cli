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
        use crate::error::wrap_error;
        std::os::windows::fs::junction_point(target, link)
            .map_err(|e| wrap_error(anyhow::anyhow!("junction create failed: {e}"), 500))?;
        Ok(())
    }
}

#[cfg(windows)]
fn remove_link(link: &Path) -> Result<()> {
    if let Err(e) = std::fs::remove_dir(link)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        use crate::error::wrap_error;
        return Err(wrap_error(anyhow::anyhow!("junction delete failed: {e}"), 500));
    }
    Ok(())
}

#[cfg(not(windows))]
fn remove_link(link: &Path) -> Result<()> {
    let md = match std::fs::symlink_metadata(link) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e.into()),
    };
    if md.is_symlink() {
        std::fs::remove_file(link)?;
    } else if md.is_dir() {
        std::fs::remove_dir_all(link)?;
    } else {
        std::fs::remove_file(link)?;
    }
    Ok(())
}
