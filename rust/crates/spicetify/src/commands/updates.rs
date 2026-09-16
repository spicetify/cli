// Spotify update handling.
//
// On macOS and Linux the self-updater fetches from a "desktop-update/v2/update" endpoint
// baked into the binary, so overwriting it with an equal-length dead string
// makes the updater unreachable regardless of how the payload is fetched.
// The patch is length-preserving, reversible and idempotent.
//
// Windows protects the updater's staging directory instead: patching the signed
// Spotify.dll invalidates its signature and the CEF launcher refuses to load it.

#[cfg(windows)]
#[path = "updates_windows.rs"]
mod windows;

#[cfg(any(target_os = "macos", test))]
use std::ffi::OsStr;
#[cfg(any(target_os = "macos", test))]
use std::path::Path;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

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
        let Some(i) = raw
            .get(off..)
            .and_then(|tail| tail.windows(from.len()).position(|w| w == from).map(|i| i + off))
        else {
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
        if let Some(candidate) = macos_spotify_binary_path(&ctx.spotify_data_dir)
            && candidate.exists()
        {
            return candidate;
        }
    }
    ctx.spotify_exec.clone()
}

#[cfg(any(target_os = "macos", test))]
fn macos_spotify_binary_path(data_dir: &Path) -> Option<PathBuf> {
    Some(data_dir.parent()?.join("MacOS").join("Spotify"))
}

/// A missing endpoint is unknown, not evidence that a block was applied.
pub fn is_blocked(ctx: &AppContext) -> Result<bool> {
    #[cfg(windows)]
    {
        let protection = windows::protection(ctx)?;
        if windows::uses_staging(ctx) || protection != windows::Protection::None {
            return Ok(protection == windows::Protection::Blocked);
        }
    }
    binary_is_blocked(ctx)
}

fn binary_is_blocked(ctx: &AppContext) -> Result<bool> {
    let raw = std::fs::read(spotify_binary(ctx))?;
    update_block_state(&raw)
}

fn update_block_state(raw: &[u8]) -> Result<bool> {
    if contains(raw, ENDPOINT_LIVE.as_bytes()) {
        return Ok(false);
    }
    anyhow::ensure!(
        contains(raw, ENDPOINT_BLOCKED.as_bytes()),
        "Spotify update endpoint not found; cannot determine or change update blocking"
    );
    Ok(true)
}

fn contains(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.windows(needle.len()).any(|w| w == needle)
}

/// Applies or reverses the update block. On macOS the bundle is ad-hoc
/// re-signed afterwards, because Apple Silicon refuses to launch an altered
/// executable; if signing fails the original bytes are restored rather than
/// leaving an unlaunchable client.
/// Records the requested policy in config.toml so it survives the update
/// that erases the patch it is written into, then applies it.
pub(crate) fn set_blocked_and_remember(ctx: &AppContext, block: bool) -> Result<()> {
    if ctx.block_spotify_updates != Some(block) {
        remember(ctx, block);
    }
    set_blocked(ctx, block)
}

/// Writes the policy to config.toml, leaving the rest of the file's settings
/// as they are. Best-effort: failing to record it costs the block on the next
/// update, which is worth a warning rather than failing the command.
fn remember(ctx: &AppContext, block: bool) {
    let mut cfg = crate::context::Config::load(&ctx.config_file).unwrap_or_default();
    cfg.block_spotify_updates = Some(block);
    if let Err(e) = cfg.save(&ctx.config_file) {
        tracing::warn!(error = %e, "could not record the update policy; it will not survive a Spotify update");
    }
}

/// Persist and verify the durable update intent. Unlike the legacy terminal
/// helper this is strict: an acknowledged update job must not open a temporary
/// updater aperture unless the replacement will be re-blocked after restart.
pub fn persist_block_intent(ctx: &AppContext) -> Result<()> {
    let mut cfg = crate::context::Config::load(&ctx.config_file)?;
    cfg.block_spotify_updates = Some(true);
    cfg.save(&ctx.config_file)?;
    let verified = crate::context::Config::load(&ctx.config_file)?;
    if verified.block_spotify_updates != Some(true) {
        anyhow::bail!("could not verify block_spotify_updates = true in config.toml");
    }
    Ok(())
}

/// Reversible admission probe for every bundle location the transaction will
/// mutate. Opening the executable writable catches macOS App Management/TCC
/// denials before Spotify is stopped; the sibling probe catches apply's Apps
/// tree writes without changing the installed archive.
pub fn preflight_mutation(ctx: &AppContext) -> Result<()> {
    #[cfg(windows)]
    let patches_binary = !windows::uses_staging(ctx);
    #[cfg(not(windows))]
    let patches_binary = true;

    if patches_binary {
        let binary = spotify_binary(ctx);
        let binary_file = std::fs::OpenOptions::new()
            .write(true)
            .open(&binary)
            .map_err(|e| anyhow::anyhow!("cannot modify {}: {e}", binary.display()))?;
        drop(binary_file);
    }
    #[cfg(windows)]
    if !patches_binary {
        let _ = windows::protection(ctx)?;
    }

    let apps = ctx.spotify_apps_path();
    std::fs::create_dir_all(&apps)?;
    let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let probe = apps.join(format!(".spicetify-update-preflight-{}-{nonce}", std::process::id()));
    let probe_file = std::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&probe)
        .map_err(|e| anyhow::anyhow!("cannot modify {}: {e}", apps.display()))?;
    drop(probe_file);
    std::fs::remove_file(&probe)
        .map_err(|e| anyhow::anyhow!("cannot remove mutation probe {}: {e}", probe.display()))?;
    Ok(())
}

/// Re-applies a remembered block. A Spotify update replaces the binary the
/// block is patched into, so without this the user silently loses the
/// protection they asked for on the first update that gets through.
pub(crate) fn reassert_block(ctx: &AppContext) {
    // Installs blocked before the policy was recorded anywhere carry their
    // intent only in the patched binary, which the next update erases. Adopt
    // it the first time we see it, so those users are protected too rather
    // than only ones who re-run the command. An unblocked client is left
    // silent: absent means "never asked", not "asked for updates".
    if ctx.block_spotify_updates.is_none() {
        if is_blocked(ctx).unwrap_or(false) {
            tracing::info!("recording the existing Spotify update block so it survives an update");
            remember(ctx, true);
        }
        return;
    }
    if ctx.block_spotify_updates != Some(true) {
        return;
    }
    match is_blocked(ctx) {
        Ok(true) => {}
        Ok(false) => {
            tracing::info!(
                "Spotify updates are unblocked but config asks for them blocked; re-blocking"
            );
            if let Err(e) = set_blocked(ctx, true) {
                tracing::warn!(error = %e, "could not re-block Spotify updates");
            }
        }
        Err(e) => {
            tracing::warn!(error = %e, "cannot determine Spotify update protection");
        }
    }
}

pub(crate) fn set_blocked(ctx: &AppContext, block: bool) -> Result<()> {
    #[cfg(windows)]
    if windows::uses_staging(ctx) || windows::protection(ctx)? != windows::Protection::None {
        return windows::set_blocked(ctx, block);
    }
    set_binary_blocked(ctx, block)
}

fn set_binary_blocked(ctx: &AppContext, block: bool) -> Result<()> {
    let path = spotify_binary(ctx);
    let mut raw = std::fs::read(&path)?;
    let _ = update_block_state(&raw)?;
    #[cfg(target_os = "macos")]
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
    tracing::info!("{} Spotify updates", if block { "Disabled" } else { "Enabled" });
    Ok(())
}

/// Changes only the installed binary. The durable intent is deliberately not
/// touched: update jobs briefly open this aperture while keeping the user's
/// requested block true in config.
pub fn set_blocked_temporarily(ctx: &AppContext, block: bool) -> Result<()> {
    set_blocked(ctx, block)
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
    let bundle = spotify_bundle_for_binary(binary)?;
    // The updater's ticket vouches for Spotify's Developer ID signature.
    // `codesign --force` replaces that signature but leaves the now-mismatched
    // ticket behind, which Gatekeeper reports as altered software.
    remove_stale_stapled_ticket(&bundle)?;
    let out = std::process::Command::new("codesign")
        .args(["--force", "--deep", "--sign", "-"])
        .arg(&bundle)
        .output()?;
    if !out.status.success() {
        return Err(anyhow::anyhow!("{}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    Ok(())
}

#[cfg(any(target_os = "macos", test))]
fn spotify_bundle_for_binary(binary: &Path) -> Result<PathBuf> {
    let macos = binary.parent();
    let contents = macos.and_then(Path::parent);
    let bundle = contents.and_then(Path::parent);
    match (macos, contents, bundle) {
        (Some(macos), Some(contents), Some(bundle))
            if macos.file_name() == Some(OsStr::new("MacOS"))
                && contents.file_name() == Some(OsStr::new("Contents"))
                && bundle.extension() == Some(OsStr::new("app")) =>
        {
            Ok(bundle.to_path_buf())
        }
        _ => anyhow::bail!(
            "Spotify executable is not inside an expected .app/Contents/MacOS bundle: {}",
            binary.display()
        ),
    }
}

#[cfg(any(target_os = "macos", test))]
fn remove_stale_stapled_ticket(bundle: &Path) -> Result<()> {
    let ticket = bundle.join("Contents").join("CodeResources");
    match std::fs::remove_file(&ticket) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(anyhow::anyhow!(
            "could not remove stale notarization ticket {}: {e}",
            ticket.display()
        )),
    }
}

#[cfg(any(target_os = "macos", test))]
fn gatekeeper_scan_result(success: bool, stdout: &str, stderr: &str) -> Result<()> {
    if success {
        return Ok(());
    }
    let detail = if stderr.trim().is_empty() { stdout.trim() } else { stderr.trim() };
    anyhow::bail!("the completed Spotify bundle failed Gatekeeper policy: {detail}")
}

#[cfg(target_os = "macos")]
fn verify_gatekeeper_policy(bundle: &Path) -> Result<()> {
    let scanner = Path::new("/usr/bin/gktool");
    if !scanner.is_file() {
        tracing::debug!("gktool is unavailable; skipping the Gatekeeper policy preflight");
        return Ok(());
    }
    tracing::info!(bundle = %bundle.display(), "verifying the completed Spotify bundle against Gatekeeper policy");
    let out = std::process::Command::new(scanner).arg("scan").arg(bundle).output()?;
    gatekeeper_scan_result(
        out.status.success(),
        &String::from_utf8_lossy(&out.stdout),
        &String::from_utf8_lossy(&out.stderr),
    )
}

/// `apply` modifies sealed resources after the endpoint patch was signed.
/// Re-seal the finished bundle and verify it before launch; otherwise a newly
/// downloaded app is rejected as damaged even though the executable patch
/// itself was signed successfully.
#[cfg(target_os = "macos")]
pub fn finalize_app_signature(ctx: &AppContext) -> Result<()> {
    let binary = spotify_binary(ctx);
    codesign_bundle(&binary)?;
    let bundle = spotify_bundle_for_binary(&binary)?;

    let out = std::process::Command::new("codesign")
        .args(["--verify", "--deep", "--strict"])
        .arg(&bundle)
        .output()?;
    if !out.status.success() {
        return Err(anyhow::anyhow!(
            "the completed Spotify bundle did not pass signature verification: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    verify_gatekeeper_policy(&bundle)
}

#[cfg(not(target_os = "macos"))]
pub fn finalize_app_signature(_ctx: &AppContext) -> Result<()> {
    Ok(())
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

    fn fixture(name: &str) -> AppContext {
        let root =
            std::env::temp_dir().join(format!("spicetify-updates-{name}-{}", std::process::id()));
        std::fs::create_dir_all(&root).expect("fixture directory");
        let launcher = root.join("Spotify.exe");
        std::fs::write(&launcher, b"").expect("fixture executable");
        let cfg = crate::context::Config { spotify_exec: Some(launcher), ..Default::default() };
        AppContext::from_config(root, &cfg).expect("fixture context")
    }

    #[test]
    fn missing_endpoints_are_unknown_not_blocked_or_already_allowed() {
        let ctx = fixture("unknown");
        std::fs::write(&ctx.spotify_exec, b"launcher without an updater").expect("launcher");
        assert!(binary_is_blocked(&ctx).is_err(), "absence of the live endpoint is not a block");
        assert!(
            set_binary_blocked(&ctx, true).is_err(),
            "must not claim an unknown binary is blocked"
        );
        assert!(
            set_binary_blocked(&ctx, false).is_err(),
            "must not claim an unknown binary is allowed"
        );
        std::fs::remove_dir_all(&ctx.config_root).expect("clean fixture");
    }

    #[test]
    fn status_requires_a_blocked_marker_and_no_live_endpoints() {
        let ctx = fixture("status");
        std::fs::write(&ctx.spotify_exec, image(ENDPOINT_BLOCKED)).expect("blocked binary");
        assert!(binary_is_blocked(&ctx).expect("recognized binary"));
        let mut mixed = image(ENDPOINT_BLOCKED);
        mixed.extend_from_slice(&image(ENDPOINT_LIVE));
        std::fs::write(&ctx.spotify_exec, mixed).expect("partially blocked binary");
        assert!(!binary_is_blocked(&ctx).expect("recognized binary"));
        std::fs::remove_dir_all(&ctx.config_root).expect("clean fixture");
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
    fn removes_only_the_stale_stapled_notarization_ticket() {
        let root = std::env::temp_dir().join(format!(
            "spicetify-stapled-ticket-test-{}-{}",
            std::process::id(),
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        let contents = root.join("Spotify.app/Contents");
        let signature = contents.join("_CodeSignature");
        std::fs::create_dir_all(&signature).unwrap();
        let ticket = contents.join("CodeResources");
        let resource_seal = signature.join("CodeResources");
        std::fs::write(&ticket, b"stale notarization ticket").unwrap();
        std::fs::write(&resource_seal, b"active resource seal").unwrap();

        remove_stale_stapled_ticket(&root.join("Spotify.app")).unwrap();

        assert!(!ticket.exists(), "the stale top-level ticket must be removed");
        assert_eq!(std::fs::read(&resource_seal).unwrap(), b"active resource seal");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_gatekeeper_policy_failure_even_after_codesign() {
        let error = gatekeeper_scan_result(
            false,
            "Scan completed, but failed because the software has been altered.",
            "",
        )
        .unwrap_err();

        assert!(error.to_string().contains("software has been altered"));
    }

    #[test]
    fn derives_the_bundle_without_traversing_through_the_executable() {
        let binary = Path::new("/Applications/Spotify.app/Contents/MacOS/Spotify");
        assert_eq!(
            spotify_bundle_for_binary(binary).unwrap(),
            Path::new("/Applications/Spotify.app")
        );
    }

    #[test]
    fn refuses_to_sign_outside_the_expected_app_bundle_layout() {
        for binary in [
            Path::new("/Applications/Spotify.app/MacOS/Spotify"),
            Path::new("/Applications/Spotify/Contents/MacOS/Spotify"),
            Path::new("/tmp/Contents/Resources/Spotify"),
        ] {
            assert!(
                spotify_bundle_for_binary(binary).is_err(),
                "unexpectedly accepted {}",
                binary.display()
            );
        }
    }

    #[test]
    fn derives_the_macos_binary_without_parent_segments() {
        let data_dir = Path::new("/Applications/Spotify.app/Contents/Resources");
        assert_eq!(
            macos_spotify_binary_path(data_dir).unwrap(),
            Path::new("/Applications/Spotify.app/Contents/MacOS/Spotify")
        );
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
