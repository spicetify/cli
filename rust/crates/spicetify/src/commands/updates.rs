// Spotify update handling.
//
// The client's self-updater fetches from a "desktop-update/v2/update" endpoint
// baked into the binary, so overwriting it with an equal-length dead string
// makes the updater unreachable regardless of how the payload is fetched.
// The patch is length-preserving, reversible and idempotent.
//
// Ported from the Go CLI (src/cmd/block-updates.go, update_policy.go), which
// remains the reference implementation; the on-disk effects are identical so
// either binary can read the other's state.

use std::path::{Path, PathBuf};

use crate::context::AppContext;
use crate::error::Result;

const ENDPOINT_PREFIX: &str = "desktop-update/";
const ENDPOINT_LIVE: &str = "desktop-update/v2/update";
const ENDPOINT_BLOCKED: &str = "desktop-update/no/thanks";

// Read by the manifest and the manager UI once the config port lands; the
// resolution rules are pinned by tests today.
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum UpdatePolicy {
    /// Hold the current version while the newest Spotify is unsupported,
    /// unblocking once a verified classmap ships. The default.
    Gate,
    /// Always freeze on the current version.
    Block,
    /// Never block.
    Allow,
}

#[allow(dead_code)]
impl UpdatePolicy {
    #[must_use]
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Gate => "gate",
            Self::Block => "block",
            Self::Allow => "allow",
        }
    }
}

/// Resolves the effective policy. An explicit value wins; with none set, the
/// legacy `block_spotify_updates` bool keeps an existing freeze; anything
/// unrecognised degrades to gate rather than erroring.
#[allow(dead_code)]
#[must_use]
pub(crate) fn resolve_policy(raw: &str, legacy_block: bool) -> UpdatePolicy {
    match raw.trim().to_lowercase().as_str() {
        "block" => UpdatePolicy::Block,
        "allow" => UpdatePolicy::Allow,
        "" if legacy_block => UpdatePolicy::Block,
        // gate is both the explicit value and the degrade-safe default for an
        // unrecognised one.
        _ => UpdatePolicy::Gate,
    }
}

/// Rewrites every update endpoint in a binary image, in place. Every
/// occurrence is patched because a universal Mach-O carries one per arch
/// slice and patching only the first would leave the running slice live.
/// Returns whether anything changed.
fn patch_update_endpoint(raw: &mut [u8], block: bool) -> bool {
    let (from, to) =
        if block { (ENDPOINT_LIVE, ENDPOINT_BLOCKED) } else { (ENDPOINT_BLOCKED, ENDPOINT_LIVE) };
    let Some(suffix) = to.as_bytes().get(ENDPOINT_PREFIX.len()..) else { return false };
    let from = from.as_bytes();

    let mut changed = false;
    let mut off = 0usize;
    while off < raw.len() {
        let Some(i) = raw.get(off..).and_then(|tail| {
            tail.windows(from.len()).position(|w| w == from).map(|i| i + off)
        }) else {
            break;
        };
        let start = i + ENDPOINT_PREFIX.len();
        let Some(slot) = raw.get_mut(start..start + suffix.len()) else { break };
        slot.copy_from_slice(suffix);
        changed = true;
        off = i + from.len();
    }
    changed
}

/// The client executable to patch. On macOS the launchable binary lives in
/// the bundle's `MacOS` directory, not beside the resources the data dir points
/// at, so resolve it rather than trusting the configured exec path.
fn spotify_binary(ctx: &AppContext) -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        let candidate = ctx.spotify_data_dir.join("..").join("MacOS").join("Spotify");
        if candidate.exists() {
            return candidate;
        }
    }
    ctx.spotify_exec.clone()
}

/// Whether the installed binary currently has its updater neutered. Valid only
/// while the endpoint string is stable: a future build that renames it would
/// read as blocked here, the same assumption the patch itself relies on.
pub(crate) fn is_blocked(ctx: &AppContext) -> Result<bool> {
    let raw = std::fs::read(spotify_binary(ctx))?;
    Ok(!contains(&raw, ENDPOINT_LIVE.as_bytes()))
}

fn contains(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.windows(needle.len()).any(|w| w == needle)
}

/// Applies or reverses the update block. On macOS the bundle is ad-hoc
/// re-signed afterwards, because Apple Silicon refuses to launch an altered
/// executable; if signing fails the original bytes are restored rather than
/// leaving an unlaunchable client.
pub(crate) fn set_blocked(ctx: &AppContext, block: bool) -> Result<()> {
    let path = spotify_binary(ctx);
    let mut raw = std::fs::read(&path)?;
    let original = raw.clone();

    if !patch_update_endpoint(&mut raw, block) {
        tracing::info!("Spotify updates already {}", if block { "blocked" } else { "allowed" });
        #[cfg(target_os = "macos")]
        set_cache_lock(block);
        return Ok(());
    }

    crate::lifecycle::stop(ctx)?;
    std::fs::write(&path, &raw)?;

    #[cfg(target_os = "macos")]
    {
        if let Err(e) = codesign_bundle(&path) {
            std::fs::write(&path, &original)?;
            return Err(anyhow::anyhow!(
                "ad-hoc re-sign failed, restored the original binary: {e}"
            ));
        }
        set_cache_lock(block);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = original;

    tracing::info!("{} Spotify updates", if block { "Disabled" } else { "Enabled" });
    Ok(())
}

/// Toggles the immutable flag on Spotify's update cache directory. Current
/// clients stage updates through a downloader that ignores this directory, so
/// it is belt-and-braces on top of the endpoint patch, never sufficient alone.
#[cfg(target_os = "macos")]
fn set_cache_lock(block: bool) {
    let Some(base) = directories::BaseDirs::new() else { return };
    let dir = base.data_dir().join("Spotify").join("PersistentCache").join("Update");
    if block {
        let _ = std::fs::create_dir_all(&dir);
    }
    let flag = if block { "uchg" } else { "nouchg" };
    let _ = std::process::Command::new("chflags").arg(flag).arg(&dir).status();
}

#[cfg(target_os = "macos")]
fn codesign_bundle(binary: &Path) -> Result<()> {
    let bundle = binary.join("..").join("..").join("..");
    let out = std::process::Command::new("codesign")
        .args(["--force", "--deep", "--sign", "-"])
        .arg(&bundle)
        .output()?;
    if out.status.success() {
        return Ok(());
    }
    Err(anyhow::anyhow!("{}", String::from_utf8_lossy(&out.stderr).trim()))
}

pub(crate) fn status(ctx: &AppContext) -> Result<()> {
    let blocked = is_blocked(ctx)?;
    tracing::info!("Spotify updates are currently {}", if blocked { "blocked" } else { "allowed" });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn image(endpoint: &str) -> Vec<u8> {
        format!("....https://x/{endpoint}?q=1....").into_bytes()
    }

    #[test]
    fn blocks_and_reverses_length_preserving() {
        let mut raw = image(ENDPOINT_LIVE);
        let before = raw.len();
        assert!(patch_update_endpoint(&mut raw, true));
        assert_eq!(raw.len(), before, "the patch must not resize the image");
        assert!(contains(&raw, ENDPOINT_BLOCKED.as_bytes()));
        assert!(!contains(&raw, ENDPOINT_LIVE.as_bytes()));

        assert!(patch_update_endpoint(&mut raw, false));
        assert!(contains(&raw, ENDPOINT_LIVE.as_bytes()));
    }

    #[test]
    fn patches_every_slice_of_a_universal_binary() {
        let mut raw = image(ENDPOINT_LIVE);
        raw.extend_from_slice(&image(ENDPOINT_LIVE));
        assert!(patch_update_endpoint(&mut raw, true));
        let hits = raw
            .windows(ENDPOINT_BLOCKED.len())
            .filter(|w| *w == ENDPOINT_BLOCKED.as_bytes())
            .count();
        assert_eq!(hits, 2, "every arch slice must be patched");
    }

    #[test]
    fn is_idempotent() {
        let mut raw = image(ENDPOINT_LIVE);
        assert!(patch_update_endpoint(&mut raw, true));
        assert!(!patch_update_endpoint(&mut raw, true), "already blocked: nothing to change");
    }

    #[test]
    fn resolves_policy_like_the_go_cli() {
        assert_eq!(resolve_policy("", false), UpdatePolicy::Gate);
        assert_eq!(resolve_policy("gate", false), UpdatePolicy::Gate);
        assert_eq!(resolve_policy("block", false), UpdatePolicy::Block);
        assert_eq!(resolve_policy("allow", false), UpdatePolicy::Allow);
        assert_eq!(resolve_policy("", true), UpdatePolicy::Block, "legacy bool honoured");
        assert_eq!(resolve_policy("allow", true), UpdatePolicy::Allow, "explicit wins");
        assert_eq!(resolve_policy("gate", true), UpdatePolicy::Gate, "explicit wins");
        assert_eq!(resolve_policy("freeze", false), UpdatePolicy::Gate, "unknown degrades");
        assert_eq!(resolve_policy("  BLOCK ", false), UpdatePolicy::Block, "trimmed and folded");
    }
}
