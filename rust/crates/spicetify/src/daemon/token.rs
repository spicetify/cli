// The daemon's loopback listener is reachable by anything running as this
// user, so its browser-facing routes require a token that only the patched
// client is handed (apply injects it into index.html). This keeps other
// origins and other software off the proxy; it is not a boundary against a
// process that can already read the user's files.

use std::path::{Path, PathBuf};

use crate::error::Result;

/// Header the patched client and the CLI present to the daemon's gated routes.
pub const HEADER: &str = "x-spicetify-token";

const TOKEN_FILE: &str = "daemon-token";
const TOKEN_BYTES: usize = 32;

fn token_path(config_root: &Path) -> PathBuf {
    config_root.join(TOKEN_FILE)
}

/// Returns the stored token, minting one on first use. The token is stable so
/// that a re-apply does not lock out a daemon that is already running.
pub fn ensure(config_root: &Path) -> Result<String> {
    if let Some(existing) = read(config_root) {
        return Ok(existing);
    }

    let mut bytes = [0u8; TOKEN_BYTES];
    getrandom::fill(&mut bytes).map_err(|e| anyhow::anyhow!("cannot generate a token: {e}"))?;
    let token = hex::encode(bytes);

    std::fs::create_dir_all(config_root)?;
    let path = token_path(config_root);
    std::fs::write(&path, &token)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))?;
    }
    Ok(token)
}

#[must_use]
pub fn read(config_root: &Path) -> Option<String> {
    let raw = std::fs::read_to_string(token_path(config_root)).ok()?;
    let trimmed = raw.trim().to_string();
    (trimmed.len() == TOKEN_BYTES * 2).then_some(trimmed)
}

/// Compares in constant time, so a caller cannot learn the token by timing
/// how far a guess matched.
#[must_use]
pub fn matches(expected: &str, presented: &str) -> bool {
    let (a, b) = (expected.as_bytes(), presented.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_only_the_exact_token() {
        assert!(matches("abc123", "abc123"));
        assert!(!matches("abc123", "abc124"));
        assert!(!matches("abc123", "abc12"));
        assert!(!matches("abc123", ""));
        assert!(!matches("", "abc123"));
    }

    #[test]
    fn a_minted_token_round_trips_and_is_stable() {
        let dir = std::env::temp_dir().join(format!("spicetify-token-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp dir");

        let first = ensure(&dir).expect("mints a token");
        assert_eq!(first.len(), TOKEN_BYTES * 2, "token is hex of {TOKEN_BYTES} bytes");
        assert_eq!(ensure(&dir).expect("reuses"), first, "a second call must not rotate it");
        assert_eq!(read(&dir).as_deref(), Some(first.as_str()));

        std::fs::write(dir.join(TOKEN_FILE), "too-short").expect("write");
        assert_eq!(read(&dir), None, "a malformed token is not accepted");

        std::fs::remove_dir_all(&dir).expect("cleanup");
    }
}
