use std::path::Path;

use crate::error::Result;

pub(crate) fn create_dir_link(target: &Path, link: &Path) -> Result<()> {
    if let Some(parent) = link.parent() {
        std::fs::create_dir_all(parent)?;
    }
    if std::fs::symlink_metadata(link).is_ok() {
        remove_dir_link(link)?;
    }
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(target, link)?;
        Ok(())
    }
    #[cfg(windows)]
    {
        junction::create(target, link)
            .map_err(|e| anyhow::anyhow!("junction create failed: {e}"))?;
        Ok(())
    }
}

#[cfg(all(test, not(windows)))]
mod tests {
    use super::*;

    fn scratch(name: &str) -> std::path::PathBuf {
        let dir =
            std::env::temp_dir().join(format!("spicetify-link-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn a_real_directory_is_replaced_by_the_link() {
        let dir = scratch("real-dir");
        let target = dir.join("target");
        let link = dir.join("link");
        std::fs::create_dir_all(&target).expect("target");
        std::fs::write(target.join("kept.txt"), "new").expect("target file");
        std::fs::create_dir_all(&link).expect("stale copy");
        std::fs::write(link.join("stale.txt"), "old").expect("stale file");

        create_dir_link(&target, &link).expect("links over a real directory");

        assert!(std::fs::symlink_metadata(&link).expect("link").is_symlink());
        assert!(link.join("kept.txt").is_file());
        assert!(!link.join("stale.txt").exists());

        std::fs::remove_dir_all(&dir).expect("cleanup");
    }

    #[test]
    fn a_broken_link_is_replaced_rather_than_colliding() {
        let dir = scratch("broken-link");
        let link = dir.join("link");
        std::os::unix::fs::symlink(dir.join("gone"), &link).expect("dangling symlink");
        let target = dir.join("target");
        std::fs::create_dir_all(&target).expect("target");

        create_dir_link(&target, &link).expect("replaces a dangling link");

        assert_eq!(std::fs::read_link(&link).expect("link"), target);

        std::fs::remove_dir_all(&dir).expect("cleanup");
    }

    #[test]
    fn removing_an_absent_link_succeeds() {
        let dir = scratch("absent");
        remove_dir_link(&dir.join("nothing-here")).expect("absent link is not an error");
        std::fs::remove_dir_all(&dir).expect("cleanup");
    }
}

#[cfg(windows)]
fn remove_dir_link(link: &Path) -> Result<()> {
    if let Err(e) = std::fs::remove_dir(link)
        && e.kind() != std::io::ErrorKind::NotFound
    {
        return Err(anyhow::anyhow!("junction delete failed: {e}"));
    }
    Ok(())
}

/// See the unix definition. `remove_dir` removes a junction but refuses a
/// non-empty real directory, so the guarantee holds here without a check.
#[cfg(windows)]
pub(crate) fn remove_link_only(link: &Path) -> Result<()> {
    remove_dir_link(link)
}

/// Removes `link`, whether it is a symlink or a real directory left behind by
/// an older install. Branches on `symlink_metadata` rather than on the error
/// from `remove_file`, which is `IsADirectory` on Linux but `PermissionDenied`
/// on macOS.
///
/// Replacing a real directory here is intended: `pkg enable` switching a
/// hand-staged build over to a store version is the documented way to do it,
/// and the user asked for it. Removal on its own goes through
/// `remove_link_only`.
#[cfg(not(windows))]
fn remove_dir_link(link: &Path) -> Result<()> {
    let meta = match std::fs::symlink_metadata(link) {
        Ok(meta) => meta,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e.into()),
    };
    if meta.is_dir() {
        std::fs::remove_dir_all(link).map_err(Into::into)
    } else {
        std::fs::remove_file(link).map_err(Into::into)
    }
}

/// Unlinks `link` without ever deleting a real directory.
///
/// `<config>/modules/<id>` is a link into the store for anything the store
/// installed, but it is a real directory when a developer staged a build
/// there by hand, and that directory is their source. Disabling or deleting a
/// module must not take it: the caller is told instead, so the removal stays
/// a deliberate act.
#[cfg(not(windows))]
pub(crate) fn remove_link_only(link: &Path) -> Result<()> {
    let meta = match std::fs::symlink_metadata(link) {
        Ok(meta) => meta,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(e.into()),
    };
    if meta.is_dir() {
        anyhow::bail!(
            "{} is a real directory, not a link into the store; refusing to delete it",
            link.display()
        );
    }
    std::fs::remove_file(link).map_err(Into::into)
}

#[cfg(all(test, not(windows)))]
mod removal_tests {
    use super::*;

    fn scratch(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("spicetify-rm-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn remove_link_only_refuses_a_developers_staged_directory() {
        let dir = scratch("staged");
        let staged = dir.join("my-mod");
        std::fs::create_dir_all(&staged).expect("staged dir");
        std::fs::write(staged.join("mod.tsx"), "source that exists nowhere else").expect("source");

        let err = remove_link_only(&staged).expect_err("a real directory must not be deleted");
        assert!(err.to_string().contains("refusing to delete"), "{err}");
        assert!(staged.join("mod.tsx").is_file(), "the developer's source survives");

        std::fs::remove_dir_all(&dir).expect("cleanup");
    }

    #[test]
    fn remove_link_only_removes_a_store_link_and_leaves_its_target() {
        let dir = scratch("store-link");
        let target = dir.join("store-copy");
        let link = dir.join("my-mod");
        std::fs::create_dir_all(&target).expect("target");
        std::fs::write(target.join("index.js").as_path(), "built").expect("target file");
        std::os::unix::fs::symlink(&target, &link).expect("link");

        remove_link_only(&link).expect("a link is removable");
        assert!(std::fs::symlink_metadata(&link).is_err(), "link is gone");
        assert!(target.join("index.js").is_file(), "the store copy is untouched");

        std::fs::remove_dir_all(&dir).expect("cleanup");
    }
}
