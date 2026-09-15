use std::path::Path;
use std::time::{Duration, Instant};

use anyhow::Context;

use crate::error::Result;

const LOCK_FILE: &str = "spicetify-disruptive-operation.lock";

/// Serializes Spotify lifecycle and package/configuration mutations. Hold this
/// across path validation and filesystem access so another package operation
/// cannot replace a checked directory with a link. The update transaction keeps
/// it for its whole lifetime; competing commands fail fast across processes.
#[derive(Debug)]
pub struct DisruptiveOperationGuard {
    file: std::fs::File,
}

impl Drop for DisruptiveOperationGuard {
    fn drop(&mut self) {
        // A concurrently spawned child can briefly retain the open file
        // description. Closing our handle alone need not release its lock.
        if let Err(error) = fs4::FileExt::unlock(&self.file) {
            tracing::warn!(%error, "failed to release the operation guard");
        }
    }
}

pub fn try_acquire(config_root: &Path) -> Result<DisruptiveOperationGuard> {
    std::fs::create_dir_all(config_root)?;
    let path = config_root.join(LOCK_FILE);
    let file = std::fs::OpenOptions::new().create(true).truncate(false).write(true).open(&path)?;
    fs4::FileExt::try_lock(&file).with_context(|| {
        format!(
            "another Spotify update, apply, or package operation is already in progress at {}; wait for it to finish and try again",
            path.display()
        )
    })?;
    Ok(DisruptiveOperationGuard { file })
}

/// Unattended repairs wait for contention; interactive commands still fail fast.
/// Real filesystem errors are not retried, nor is the operation inside the guard.
pub fn acquire_with_timeout(
    config_root: &Path,
    timeout: Duration,
) -> Result<DisruptiveOperationGuard> {
    let deadline = Instant::now() + timeout;
    loop {
        match try_acquire(config_root) {
            Ok(guard) => return Ok(guard),
            Err(error) => {
                let remaining = deadline.saturating_duration_since(Instant::now());
                if !is_contention(&error) || remaining.is_zero() {
                    return Err(error);
                }
                std::thread::sleep(remaining.min(Duration::from_secs(2)));
            }
        }
    }
}

pub fn is_contention(error: &anyhow::Error) -> bool {
    matches!(error.downcast_ref::<fs4::TryLockError>(), Some(fs4::TryLockError::WouldBlock))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch() -> Result<std::path::PathBuf> {
        let mut nonce = [0; 16];
        getrandom::fill(&mut nonce)?;
        let root = std::env::temp_dir().join(format!("spicetify-guard-{}", hex::encode(nonce)));
        std::fs::create_dir(&root)?;
        Ok(root)
    }

    #[test]
    fn contention_retains_its_typed_cause_for_retry() -> Result<()> {
        let root = scratch()?;
        let guard = try_acquire(&root)?;
        let error = try_acquire(&root).expect_err("guard is already held");
        drop(guard);
        std::fs::remove_dir_all(&root)?;
        assert!(error.downcast_ref::<fs4::TryLockError>().is_some(), "{error}");
        Ok(())
    }

    #[test]
    fn dropping_the_guard_unlocks_even_while_a_duplicate_handle_survives() -> Result<()> {
        let root = scratch()?;
        let guard = try_acquire(&root)?;
        let duplicate = guard.file.try_clone()?;
        drop(guard);
        let result = try_acquire(&root);
        drop(duplicate);
        drop(result?);
        std::fs::remove_dir_all(&root)?;
        Ok(())
    }

    #[test]
    fn waiting_acquires_the_guard_after_the_competing_operation_finishes() -> Result<()> {
        let root = scratch()?;
        let guard = try_acquire(&root)?;
        let release = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(20));
            drop(guard);
        });
        let result = acquire_with_timeout(&root, Duration::from_secs(10));
        release.join().expect("release thread");
        drop(result?);
        std::fs::remove_dir_all(&root)?;
        Ok(())
    }

    #[test]
    fn waiting_stops_at_the_deadline_and_does_not_retry_filesystem_errors() -> Result<()> {
        let root = scratch()?;
        let guard = try_acquire(&root)?;
        let error = acquire_with_timeout(&root, Duration::ZERO).unwrap_err();
        assert!(matches!(
            error.downcast_ref::<fs4::TryLockError>(),
            Some(fs4::TryLockError::WouldBlock)
        ));
        drop(guard);
        let file = root.join("not-a-directory");
        std::fs::write(&file, "sentinel")?;
        let error = acquire_with_timeout(&file, Duration::from_secs(60)).unwrap_err();
        assert!(error.downcast_ref::<std::io::Error>().is_some());
        assert!(error.downcast_ref::<fs4::TryLockError>().is_none());
        std::fs::remove_dir_all(&root)?;
        Ok(())
    }
}
