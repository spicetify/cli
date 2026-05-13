use std::{fs, path::Path};

use anyhow::Result;

pub fn create_dir_link(src: &Path, dst: &Path) -> Result<()> {
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent)?;
    }
    let _ = fs::remove_dir_all(dst);
    let _ = fs::remove_file(dst);

    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(src, dst)?;
        return Ok(());
    }

    #[cfg(windows)]
    {
        let result = std::os::windows::fs::symlink_dir(src, dst);
        match result {
            Ok(()) => return Ok(()),
            Err(e) if e.raw_os_error() == Some(1314) => {
                return junction::create(src, dst).map_err(Into::into);
            }
            Err(e) => return Err(e.into()),
        }
    }

    #[allow(unreachable_code)]
    Ok(())
}
