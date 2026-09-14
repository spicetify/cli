use std::path::{Path, PathBuf};

use crate::context::AppContext;
use crate::error::Result;
use crate::{fl, util};

const APPLY_LOCK_FILE: &str = "spicetify-apply.lock";

// The foreground CLI and daemon both enter this command and mutate the same
// xpui.spa, backup and xpui.tmp paths. Keep one persistent lock file: deleting
// it on drop could let a third process lock a new inode while a waiter still
// owns the old one.
#[derive(Debug)]
struct ApplyLock {
    _file: std::fs::File,
}

fn acquire_apply_lock(config_root: &Path) -> Result<ApplyLock> {
    std::fs::create_dir_all(config_root)
        .map_err(fs_err("creating the config root at", config_root))?;
    let path = config_root.join(APPLY_LOCK_FILE);
    let file = std::fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(&path)
        .map_err(fs_err("opening the apply lock at", &path))?;

    file.lock()
        .map_err(|e| anyhow::anyhow!("locking the apply operation at {}: {e}", path.display()))?;
    Ok(ApplyLock { _file: file })
}

// Attaches the operation and path to a filesystem error, so an apply failure
// says which file it choked on and what it was doing, not a bare errno. Every
// failure in this path has to name its own reason.
fn fs_err<'a>(doing: &'a str, path: &'a Path) -> impl FnOnce(std::io::Error) -> anyhow::Error + 'a {
    move |e| anyhow::anyhow!("{doing} {}: {e}", path.display())
}

pub fn run(
    ctx: &AppContext,
    _operation_guard: &super::guard::DisruptiveOperationGuard,
) -> Result<()> {
    let _apply_lock = acquire_apply_lock(&ctx.config_root)?;
    let dest_apps = ctx.dest_apps_path();
    let spa = ctx.spotify_apps_path().join("xpui.spa");
    let dest_xpui = dest_apps.join("xpui");
    let backup = spa.with_extension("spa.backup");

    // The artifacts alone distinguish three states:
    //   xpui.spa present           -> stock; fresh apply
    //   xpui.spa.backup present    -> ours; re-apply from that backup
    //   neither, but xpui/ present -> patched by another tool, which consumed
    //                                 the archive entirely. Patching over it
    //                                 would corrupt the client, so refuse and
    //                                 name the real cause instead of claiming
    //                                 it is already applied.
    if !spa.exists() && !ctx.mirror && !backup.exists() && dest_xpui.exists() {
        return Err(anyhow::anyhow!(fl!("foreign-apply")));
    }

    // Refuse before anything destructive: the first steps stop the client
    // and rename xpui.spa, so a client this CLI cannot patch must be turned
    // away here rather than left without a servable xpui.
    let detected = detect_supported_spotify_version(ctx)?;

    crate::lifecycle::stop(ctx)?;

    if !spa.exists() && !ctx.mirror && backup.exists() {
        tracing::info!("{}", fl!("restoring-spa-backup", path = spa.to_string_lossy()));
        std::fs::rename(&backup, &spa)
            .map_err(fs_err("restoring xpui.spa from the backup at", &spa))?;
    }

    // Names the path on failure: a bare "Permission denied" here means the
    // resolved Spotify directory is not writable (often a system-wide install,
    // or a bundle detection that missed the real location), and the errno
    // alone does not say which directory to look at.
    std::fs::create_dir_all(&dest_apps).map_err(|e| {
        anyhow::anyhow!(
            "cannot prepare {}: {e}. If Spotify is installed elsewhere, set spotify_data_dir in config.toml",
            dest_apps.display()
        )
    })?;
    tracing::info!(
        "{}",
        fl!("extracting-spa", src = spa.to_string_lossy(), dest = dest_xpui.to_string_lossy())
    );

    let tmp = dest_apps.join("xpui.tmp");
    if tmp.exists() {
        cleanup_tmp(&tmp);
    }

    if let Err(e) = extract_into(&spa, &tmp) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    if !ctx.mirror {
        if let Err(e) = std::fs::remove_file(&backup)
            && e.kind() != std::io::ErrorKind::NotFound
        {
            tracing::warn!(error = %e, path = %backup.display(), "failed to remove file");
        }
        if let Err(e) = std::fs::rename(&spa, &backup) {
            cleanup_tmp(&tmp);
            return Err(anyhow::anyhow!("failed to backup xpui.spa: {e}"));
        }
    }

    // Refreshes the classmap cache and the exposure patches together: the
    // patches are applied to the client bundle prepared next, so they must be
    // current before that step, not at module staging.
    if let Some(version) = &detected {
        refresh_classmap(ctx, &version.to_string());
    }

    let client_bundle = match detect_client_bundle(&tmp) {
        Ok(bundle) => bundle,
        Err(e) => {
            cleanup_tmp(&tmp);
            return Err(e);
        }
    };
    if let Err(e) = prepare_client_bundle(ctx, &tmp, client_bundle) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    tracing::info!("{}", fl!("patching-index"));
    if let Err(e) = patch_index(ctx, &tmp, client_bundle) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    if let Err(e) = link_runtime_dirs(&ctx.config_root, &tmp) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    if let Err(e) = stage_payload(&ctx.config_root, &tmp) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    if let Err(e) = stage_modules(ctx, &tmp) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    // Last, so the rename reaches the staged modules too: they carry hashed
    // class names from the classmap, and this pass renames those same hashes
    // inside the client. Rewriting only one side leaves module elements
    // pointing at classes that no longer exist, so they render unstyled.
    if let Err(e) = apply_css_map(ctx, &tmp) {
        cleanup_tmp(&tmp);
        return Err(e);
    }

    if dest_xpui.exists() {
        std::fs::remove_dir_all(&dest_xpui)
            .map_err(fs_err("removing the previous xpui at", &dest_xpui))?;
    }
    std::fs::rename(&tmp, &dest_xpui)
        .map_err(fs_err("installing the patched client to", &dest_xpui))?;

    // The update block's endpoint patch is signed while modules are staged,
    // before xpui.tmp replaces the served tree. Seal and verify the final
    // bundle, not that intermediate resource set.
    super::updates::finalize_app_signature(ctx)?;

    ensure_daemon(ctx);

    crate::lifecycle::start(ctx)?;

    crate::platform::register_url_scheme();

    tracing::info!("{}", fl!("applied-patches"));
    Ok(())
}

fn detect_supported_spotify_version(ctx: &AppContext) -> Result<Option<semver::Version>> {
    match crate::hooks::version_detect::detect_spotify_version(ctx) {
        Ok(version) if !crate::hooks::version_detect::spotify_supported(&version) => {
            Err(anyhow::anyhow!(fl!(
                "spotify-too-old",
                version = version.to_string(),
                min = crate::hooks::version_detect::MIN_SUPPORTED_SPOTIFY.to_string()
            )))
        }
        Ok(version) => Ok(Some(version)),
        Err(e) => {
            tracing::warn!(error = %e, "could not detect the Spotify version before apply");
            Ok(None)
        }
    }
}

// The daemon re-applies spicetify after Spotify updates itself, which is the
// whole point of having one, so apply keeps it installed and running unless
// `daemon = false` says otherwise. Failing to start it never fails the apply.
fn ensure_daemon(ctx: &AppContext) {
    if !ctx.daemon {
        tracing::info!(
            "daemon disabled in config: spicetify will not re-apply itself after a Spotify update"
        );
        return;
    }

    if crate::daemon::is_daemon_running() {
        let running = crate::daemon::health_check().map(|h| h.version);
        if !daemon_is_current(running.as_deref()) {
            tracing::info!(
                "restarting the daemon: it is running {} while this CLI is {}",
                running.as_deref().unwrap_or("an unknown version"),
                crate::VERSION
            );
            // stop() also unregisters auto-start, which is what makes the
            // replacement stick: a KeepAlive supervisor would otherwise
            // revive the old binary the moment it exits.
            if let Err(e) = super::daemon::stop() {
                tracing::warn!(error = %e, "could not stop the outdated daemon");
            }
        }
    }

    // Registers auto-start with this CLI's own daemon binary. This runs after
    // any stop because stop unregisters; registering first left every
    // upgrade with the registration undone and the daemon back unsupervised.
    if let Err(e) = super::daemon::install() {
        tracing::warn!(error = %e, "could not enable the daemon at login");
    }

    // A supervisor that starts what it registers (systemd, launchd) has the
    // daemon up by now or within a moment; only spawn when nothing answers,
    // so there is never a second, unsupervised copy beside the managed one.
    if !daemon_comes_up(std::time::Duration::from_secs(2))
        && let Err(e) = super::daemon::start()
    {
        tracing::warn!(error = %e, "could not start the daemon");
    }
}

fn daemon_comes_up(within: std::time::Duration) -> bool {
    let deadline = std::time::Instant::now() + within;
    loop {
        if crate::daemon::is_daemon_running() {
            return true;
        }
        if std::time::Instant::now() >= deadline {
            return false;
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
}

/// A daemon from an older install keeps serving its own behaviour until it is
/// replaced, so an upgrade only takes effect once the running one matches.
fn daemon_is_current(running: Option<&str>) -> bool {
    running == Some(crate::VERSION)
}

fn cleanup_tmp(tmp: &Path) {
    if let Err(e) = std::fs::remove_dir_all(tmp) {
        tracing::warn!(error = %e, path = %tmp.display(), "failed to clean up temp dir");
    }
}

fn extract_into(spa: &Path, dest: &Path) -> Result<()> {
    if !spa.exists() {
        return Err(anyhow::anyhow!(fl!("xpui-not-found", path = spa.to_string_lossy())));
    }
    util::unzip_file(spa, dest).map_err(|e| anyhow::anyhow!("failed to extract spa: {e}"))?;
    Ok(())
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ClientBundle {
    Snapshot,
    Direct,
}

impl ClientBundle {
    const fn script_tag(self) -> &'static str {
        match self {
            Self::Snapshot => SNAPSHOT_TAG,
            Self::Direct => DIRECT_BUNDLE_TAG,
        }
    }

    const fn loader_value(self) -> &'static str {
        match self {
            Self::Snapshot => "snapshot",
            Self::Direct => "direct",
        }
    }
}

fn detect_client_bundle(dest: &Path) -> Result<ClientBundle> {
    let index = dest.join("index.html");
    let raw = std::fs::read_to_string(&index).map_err(fs_err("reading", &index))?;
    detect_client_bundle_html(&raw)
}

fn detect_client_bundle_html(index: &str) -> Result<ClientBundle> {
    match (index.contains(SNAPSHOT_TAG), index.contains(DIRECT_BUNDLE_TAG)) {
        (true, false) => Ok(ClientBundle::Snapshot),
        (false, true) => Ok(ClientBundle::Direct),
        _ => Err(anyhow::anyhow!(fl!("index-patch-not-found"))),
    }
}

fn prepare_client_bundle(ctx: &AppContext, dest: &Path, client_bundle: ClientBundle) -> Result<()> {
    let (output, js) = match client_bundle {
        ClientBundle::Direct => {
            let output = dest.join("xpui.js");
            let js = std::fs::read_to_string(&output)
                .map_err(fs_err("reading the direct client bundle at", &output))?;
            (output, js)
        }
        ClientBundle::Snapshot => extract_snapshot_bundle(ctx, dest)?,
    };

    let patches = crate::module::expose::load_patches(&ctx.config_root);
    let patched = crate::module::expose::expose_apis(js, &patches);
    std::fs::write(&output, patched)
        .map_err(fs_err("writing the patched client bundle at", &output))?;
    Ok(())
}

fn extract_snapshot_bundle(ctx: &AppContext, dest: &Path) -> Result<(PathBuf, String)> {
    let spotify_data: &Path = &ctx.spotify_data_dir;
    let offline_bnk_dir: &Path = &ctx.offline_bnk_dir;
    let snapshot = locate_snapshot(spotify_data, offline_bnk_dir).ok_or_else(|| {
        let searched = snapshot_search_dirs(spotify_data, offline_bnk_dir)
            .iter()
            .map(|d| d.display().to_string())
            .collect::<Vec<_>>()
            .join(", ");
        anyhow::anyhow!("{}; searched: {searched}", fl!("snapshot-not-found"))
    })?;

    let data = std::fs::read(&snapshot).map_err(fs_err("reading the v8 snapshot at", &snapshot))?;
    let js =
        util::extract_utf16le_between(&data, "var __webpack_modules__={", "xpui-modules.js.map")
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "could not locate xpui-modules.js.map markers in v8 snapshot at {}",
                    snapshot.display()
                )
            })?;
    let out = dest.join("xpui-modules.js");
    Ok((out, js))
}

// Search order: the Spotify data dir, then platform-specific locations (macOS
// keeps the snapshot inside the CEF framework bundle), then the offline-bnk
// cache. A missing directory is skipped rather than fatal.
fn snapshot_search_dirs(spotify_data: &Path, offline_bnk_dir: &Path) -> Vec<PathBuf> {
    let mut dirs = vec![spotify_data.to_path_buf()];
    dirs.extend(crate::platform::snapshot_dirs(spotify_data));
    dirs.push(offline_bnk_dir.to_path_buf());
    dirs
}

fn locate_snapshot(spotify_data: &Path, offline_bnk_dir: &Path) -> Option<PathBuf> {
    snapshot_search_dirs(spotify_data, offline_bnk_dir)
        .iter()
        .find_map(|dir| find_snapshot(dir).ok().flatten())
}

fn find_snapshot(dir: &Path) -> Result<Option<PathBuf>> {
    let entry = std::fs::read_dir(dir)?.filter_map(std::io::Result::ok).find(|e| {
        e.file_name().to_str().is_some_and(|n| {
            n.starts_with("v8_context_snapshot")
                && n.len() > 4
                && n[n.len() - 4..].eq_ignore_ascii_case(".bin")
        })
    });
    Ok(entry.map(|e| e.path()))
}

// Rewrites the client's hashed class names to the stable semantic names the
// ecosystem targets. Without it every `.main-*` selector misses: stdlib's
// registers have nothing to anchor to and themes style nothing.
fn apply_css_map(ctx: &AppContext, dest: &Path) -> Result<()> {
    let version = crate::hooks::version_detect::detect_spotify_version(ctx)
        .map(|v| v.to_string())
        .unwrap_or_default();
    let key = crate::module::stage::classmap_key_for_version(&version).unwrap_or_default();

    let Some(map) = crate::module::cssmap::CssMap::load(&ctx.config_root, &key) else {
        tracing::warn!(
            "no css map found: the client keeps its hashed class names, so `.main-*` selectors will not match"
        );
        return Ok(());
    };
    let touched = crate::module::cssmap::apply_to_tree(&map, dest)?;
    tracing::info!("rewrote class names in {touched} file(s)");
    Ok(())
}

// Classmaps are published per Spotify build, so apply pulls the current one
// before staging. A failure here is not fatal: whatever is already cached (or
// shipped) still applies, which keeps apply working offline.
fn refresh_classmap(ctx: &AppContext, version: &str) {
    if std::env::var_os("SPICETIFY_CLASSMAPS_DIR").is_some() {
        tracing::debug!("SPICETIFY_CLASSMAPS_DIR is set: skipping the classmap fetch");
        return;
    }
    let Some(wanted) = crate::module::stage::classmap_key_for_version(version) else {
        return;
    };
    match crate::module::remote::fetch_classmap(&ctx.config_root, &wanted) {
        Ok(key) if key == wanted => tracing::info!("classmap {key} is current"),
        Ok(key) => tracing::info!("no published classmap for {wanted}; cached {key} instead"),
        Err(e) => {
            tracing::warn!(error = %e, "could not refresh the classmap; using what is cached");
        }
    }
}

// The modular loader boots from <xpui>/modules/manifest.json, which carries the
// classmap for this Spotify build alongside each module's metadata.
fn stage_modules(ctx: &AppContext, dest: &Path) -> Result<()> {
    let modules_root = crate::module::modules_dir(&ctx.config_root);
    let version = crate::hooks::version_detect::detect_spotify_version(ctx)
        .map(|v| v.to_string())
        .unwrap_or_default();
    if version.is_empty() {
        tracing::warn!("cannot detect the Spotify version: skipping module staging");
        return Ok(());
    }

    // A fresh config has no modules, so without this the client boots without
    // its library, store, or manager surfaces and the user has no way in.
    // Runs before staging so anything seeded is staged in this same apply; a
    // no-op once they exist.
    super::pkg::ensure_system_modules(ctx);
    // A Spotify update wipes the binary patch that blocks its updater, and
    // apply is what runs right after one; restore the user's stated policy
    // here rather than leaving them silently unprotected.
    super::updates::reassert_block(ctx);

    let updates_blocked = super::updates::is_blocked(ctx).unwrap_or(false);

    match crate::module::stage::stage_modules(
        &ctx.config_root,
        &modules_root,
        dest,
        &version,
        env!("CARGO_PKG_VERSION"),
        updates_blocked,
    ) {
        Ok(0) => {
            tracing::warn!("no modules staged: the client will boot without them");
            Ok(())
        }
        Ok(n) => {
            tracing::info!("staged {n} module(s)");
            Ok(())
        }
        Err(e) => Err(e),
    }
}

fn patch_index(ctx: &AppContext, dest: &Path, client_bundle: ClientBundle) -> Result<()> {
    // The client is handed the daemon token so its proxy calls are accepted;
    // nothing else served from this origin can read it.
    let token = crate::daemon::token::ensure(&ctx.config_root).unwrap_or_default();
    let index = dest.join("index.html");
    let raw = std::fs::read_to_string(&index).map_err(fs_err("reading", &index))?;
    let patched = patch_index_html(&raw, &token, client_bundle)?;
    std::fs::write(&index, patched).map_err(fs_err("writing", &index))?;
    Ok(())
}

// Modules are staged (copied and classmap-remapped) rather than linked, so
// `modules` is deliberately absent here: see stage_modules. macOS also needs
// the store snapshot copied: a sealed app bundle cannot point at resources
// outside itself through a symlink and still pass Gatekeeper validation.
fn link_runtime_dirs(config_root: &Path, dest: &Path) -> Result<()> {
    let src = config_root.join("store");
    let dst = dest.join("store");
    if !src.exists() {
        std::fs::create_dir_all(&src).map_err(fs_err("creating", &src))?;
    }
    stage_runtime_dir(&src, &dst)?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn stage_runtime_dir(src: &Path, dst: &Path) -> Result<()> {
    tracing::info!(src = %src.display(), dst = %dst.display(), "copying runtime directory into the signed app bundle");
    copy_dir_snapshot(src, dst, &mut std::collections::HashSet::new())
}

#[cfg(not(target_os = "macos"))]
fn stage_runtime_dir(src: &Path, dst: &Path) -> Result<()> {
    tracing::info!(
        "{}",
        fl!("linking-dir", dst = dst.to_string_lossy(), src = src.to_string_lossy())
    );
    util::create_dir_link(src, dst)
}

#[cfg(target_os = "macos")]
fn copy_dir_snapshot(
    src: &Path,
    dst: &Path,
    ancestors: &mut std::collections::HashSet<PathBuf>,
) -> Result<()> {
    let canonical = std::fs::canonicalize(src).map_err(fs_err("resolving", src))?;
    if !ancestors.insert(canonical.clone()) {
        anyhow::bail!("runtime directory contains a symlink cycle at {}", src.display());
    }
    std::fs::create_dir_all(dst).map_err(fs_err("creating", dst))?;
    let result = (|| {
        for entry in std::fs::read_dir(src).map_err(fs_err("reading", src))? {
            let entry = entry.map_err(fs_err("reading an entry under", src))?;
            let source = entry.path();
            let target = dst.join(entry.file_name());
            let metadata = std::fs::metadata(&source).map_err(fs_err("resolving", &source))?;
            if metadata.is_dir() {
                copy_dir_snapshot(&source, &target, ancestors)?;
            } else if metadata.is_file() {
                let _bytes = std::fs::copy(&source, &target)
                    .map_err(fs_err("copying into the signed app bundle at", &target))?;
            } else {
                anyhow::bail!("unsupported runtime entry at {}", source.display());
            }
        }
        Ok(())
    })();
    debug_assert!(ancestors.remove(&canonical));
    result
}

// The wrapper and loader the patched index.html loads: the embedded copy,
// unless the config root holds a marked developer payload.
fn stage_payload(config_root: &Path, dest: &Path) -> Result<()> {
    let local = config_root.join("hooks");
    let hooks = dest.join("hooks");

    if crate::payload::is_local_override(&local) {
        tracing::warn!(
            path = %local.display(),
            "using a local developer payload instead of the embedded one"
        );
        stage_runtime_dir(&local, &hooks)?;
        return Ok(());
    }

    crate::payload::write_into(&hooks)?;
    tracing::info!("staged the embedded client payload");
    Ok(())
}

// The payload is injected as classic, non-deferred scripts at the top of
// <body>: the wrapper must run before the client bundle to intercept webpack,
// and a module script would be deferred until after it. The stock bundle tag
// is stripped because the modular loader boots the client itself once mixins
// have run. Spotify 1.3 ships one direct xpui.js bundle; older clients split
// the modules table into the v8 snapshot and boot it with xpui-snapshot.js.
const SNAPSHOT_TAG: &str = "<script defer=\"defer\" src=\"/xpui-snapshot.js\"></script>";
const DIRECT_BUNDLE_TAG: &str = "<script defer=\"defer\" src=\"/xpui.js\"></script>";
const BODY_TAG: &str = "<body";

// The body tag is not always bare: Linux builds ship
// `<body class="encore-dark-theme encore-layout-themes">`, so the insertion
// point is the closing `>` of the opening tag, wherever its attributes end.
fn body_insert_at(input: &str) -> Option<usize> {
    let start = input.find(BODY_TAG)?;
    let rest = &input[start + BODY_TAG.len()..];
    if !rest.starts_with('>') && !rest.starts_with(|c: char| c.is_ascii_whitespace()) {
        return None;
    }
    let close = rest.find('>')?;
    Some(start + BODY_TAG.len() + close + 1)
}

fn patch_index_html(
    input: &str,
    daemon_token: &str,
    client_bundle: ClientBundle,
) -> Result<String> {
    let app_version = env!("CARGO_PKG_VERSION");
    let bundle_tag = client_bundle.script_tag();
    if !input.contains(bundle_tag) {
        return Err(anyhow::anyhow!(fl!("index-patch-not-found")));
    }
    let insert_at =
        body_insert_at(input).ok_or_else(|| anyhow::anyhow!(fl!("index-patch-not-found")))?;

    let payload = format!(
        concat!(
            "\n<script>globalThis.__SPICETIFY_APP_VERSION__=\"{}\";",
            "globalThis.__SPICETIFY_DAEMON_TOKEN__=\"{}\";",
            "globalThis.__SPICETIFY_CLIENT_BUNDLE_MODE__=\"{}\";</script>\n",
            "<script src='hooks/spicetifyWrapper.js'></script>\n",
            "<!-- spicetify helpers -->\n",
            "<script src='hooks/modularLoader.js'></script>\n"
        ),
        app_version,
        daemon_token,
        client_bundle.loader_value()
    );

    let patched = format!("{}{}{}", &input[..insert_at], payload, &input[insert_at..]);
    Ok(patched.replace(bundle_tag, ""))
}

#[cfg(test)]
mod tests {
    use super::*;

    const STOCK: &str = r#"<!doctype html><html><head><title>Spotify</title></head><body><div class="body-drag-top"></div><script defer="defer" src="/xpui-snapshot.js"></script></body></html>"#;
    const STOCK_DIRECT: &str = r#"<!doctype html><html><head><title>Spotify</title></head><body><div class="body-drag-top"></div><script defer="defer" src="/xpui.js"></script></body></html>"#;

    #[test]
    fn injects_payload_and_strips_snapshot_tag() {
        let out =
            patch_index_html(STOCK, "tok", ClientBundle::Snapshot).expect("stock index patches");
        assert!(out.contains("<script src='hooks/spicetifyWrapper.js'></script>"));
        assert!(out.contains("<script src='hooks/modularLoader.js'></script>"));
        assert!(out.contains("__SPICETIFY_APP_VERSION__"));
        assert!(!out.contains(SNAPSHOT_TAG), "loader re-injects the snapshot itself");
    }

    #[test]
    fn wrapper_runs_before_the_client_bundle() {
        let out =
            patch_index_html(STOCK, "tok", ClientBundle::Snapshot).expect("stock index patches");
        let wrapper = out.find("hooks/spicetifyWrapper.js").expect("wrapper injected");
        let loader = out.find("hooks/modularLoader.js").expect("loader injected");
        let body = out.find(BODY_TAG).expect("body present");
        assert!(
            body < wrapper && wrapper < loader,
            "payload order must be body -> wrapper -> loader"
        );
        // Nothing may be deferred: defer would run after the client bundle.
        assert!(!out.contains("defer src='hooks/"));
    }

    #[test]
    fn patches_a_body_tag_with_attributes() {
        let stock_linux =
            STOCK.replace("<body>", r#"<body class="encore-dark-theme encore-layout-themes">"#);
        let out = patch_index_html(&stock_linux, "tok", ClientBundle::Snapshot)
            .expect("attributed body patches");
        let class_attr = out.find("encore-dark-theme").expect("body attributes kept");
        let wrapper = out.find("hooks/spicetifyWrapper.js").expect("wrapper injected");
        assert!(class_attr < wrapper, "payload lands inside body, after the opening tag");
    }

    #[test]
    fn injects_payload_and_strips_the_spotify_1_3_bundle_tag() {
        let out = patch_index_html(STOCK_DIRECT, "tok", ClientBundle::Direct)
            .expect("Spotify 1.3 index patches");
        assert!(out.contains("<script src='hooks/spicetifyWrapper.js'></script>"));
        assert!(out.contains("<script src='hooks/modularLoader.js'></script>"));
        assert!(out.contains("__SPICETIFY_CLIENT_BUNDLE_MODE__=\"direct\""));
        assert!(!out.contains(r#"src="/xpui.js""#), "loader boots the direct bundle itself");
    }

    #[test]
    fn detects_the_bundle_from_the_stock_index() {
        assert_eq!(
            detect_client_bundle_html(STOCK).expect("snapshot index detected"),
            ClientBundle::Snapshot
        );
        assert_eq!(
            detect_client_bundle_html(STOCK_DIRECT).expect("direct index detected"),
            ClientBundle::Direct
        );
    }

    #[test]
    fn refuses_ambiguous_bundle_anchors() {
        let both = STOCK.replace(SNAPSHOT_TAG, &format!("{SNAPSHOT_TAG}{DIRECT_BUNDLE_TAG}"));
        assert!(detect_client_bundle_html(&both).is_err());
        assert!(detect_client_bundle_html("<html><body></body></html>").is_err());
    }

    #[test]
    fn refuses_an_index_without_the_snapshot_anchor() {
        let already = "<html><body></body></html>";
        assert!(
            patch_index_html(already, "tok", ClientBundle::Snapshot).is_err(),
            "an unrecognised index must not be patched"
        );
    }

    #[test]
    fn prepares_a_direct_bundle_with_exposure_patches() {
        let root =
            std::env::temp_dir().join(format!("spicetify-direct-bundle-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let xpui = root.join("xpui");
        let classmaps = root.join("classmaps");
        std::fs::create_dir_all(&xpui).expect("temporary xpui directory");
        std::fs::create_dir_all(&classmaps).expect("temporary classmap directory");
        std::fs::write(xpui.join("xpui.js"), "stockClient();").expect("direct client bundle");
        std::fs::write(
            classmaps.join("expose.json"),
            r#"{"patches":[{"name":"test direct bundle","pattern":"stockClient","replace":"Spicetify.testClient","once":true,"onMiss":"warn"}]}"#,
        )
        .expect("controlled exposure patch");
        let ctx = AppContext {
            config_file: root.join("config.toml"),
            config_root: root.clone(),
            mirror: true,
            daemon: false,
            spotify_data_dir: root.clone(),
            spotify_exec: root.join("Spotify"),
            offline_bnk_dir: root.clone(),
            block_spotify_updates: None,
        };

        prepare_client_bundle(&ctx, &xpui, ClientBundle::Direct).expect("direct bundle patches");
        assert_eq!(
            std::fs::read_to_string(xpui.join("xpui.js")).expect("patched direct bundle"),
            "Spicetify.testClient();"
        );
        std::fs::remove_dir_all(root).expect("cleanup direct bundle test");
    }

    #[test]
    #[ignore = "requires a stock Spotify 1.3 xpui.spa"]
    fn prepares_a_real_spotify_1_3_archive() {
        let archive = std::env::var_os("SPICETIFY_TEST_SPOTIFY_SPA")
            .map(PathBuf::from)
            .expect("set SPICETIFY_TEST_SPOTIFY_SPA to a stock Spotify 1.3 xpui.spa");
        let root =
            std::env::temp_dir().join(format!("spicetify-spotify-1.3-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let xpui = root.join("xpui");

        extract_into(&archive, &xpui).expect("Spotify 1.3 archive extracts");
        let ctx = AppContext {
            config_file: root.join("config.toml"),
            config_root: root.clone(),
            mirror: true,
            daemon: false,
            spotify_data_dir: root.clone(),
            spotify_exec: root.join("Spotify"),
            offline_bnk_dir: root.clone(),
            block_spotify_updates: None,
        };
        let bundle = detect_client_bundle(&xpui).expect("direct bundle detected");
        assert_eq!(bundle, ClientBundle::Direct);
        prepare_client_bundle(&ctx, &xpui, bundle).expect("direct bundle patches");

        let direct = std::fs::read_to_string(xpui.join("xpui.js")).expect("patched xpui.js");
        assert!(direct.contains("Spicetify._platform="), "Platform exposure patch applied");
        assert!(direct.contains("Spicetify.URI="), "URI exposure patch applied");

        let index = std::fs::read_to_string(xpui.join("index.html")).expect("stock index");
        let index = patch_index_html(&index, "tok", bundle).expect("Spotify 1.3 index patches");
        assert!(index.contains("__SPICETIFY_CLIENT_BUNDLE_MODE__=\"direct\""));
        assert!(!index.contains(DIRECT_BUNDLE_TAG));

        std::fs::remove_dir_all(root).expect("cleanup real archive test");
    }

    #[test]
    fn waits_for_another_apply_to_release_the_apply_lock() {
        let root =
            std::env::temp_dir().join(format!("spicetify-apply-lock-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("temp config root");

        let lock_path = root.join("spicetify-apply.lock");
        let held_lock = std::fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .write(true)
            .open(&lock_path)
            .expect("apply lock file");
        held_lock.try_lock().expect("simulate the other process");

        let ctx = AppContext {
            config_file: root.join("config.toml"),
            config_root: root.clone(),
            mirror: true,
            daemon: false,
            spotify_data_dir: root.join("missing-spotify-data"),
            spotify_exec: root.join("spicetify-test-missing-spotify"),
            offline_bnk_dir: root.join("missing-offline-bnk"),
            block_spotify_updates: None,
        };

        let (tx, rx) = std::sync::mpsc::channel();
        let apply = std::thread::spawn(move || {
            let guard = super::super::guard::try_acquire(&ctx.config_root)
                .expect("synthetic apply owns the disruptive-operation guard");
            tx.send(run(&ctx, &guard)).expect("test receiver remains available");
        });
        assert!(
            rx.recv_timeout(std::time::Duration::from_millis(100)).is_err(),
            "the second apply must wait while the lock is held"
        );

        drop(held_lock);
        let error = rx
            .recv_timeout(std::time::Duration::from_secs(2))
            .expect("the waiting apply continues after the lock is released")
            .expect_err("the synthetic Spotify install has no xpui.spa");
        assert!(error.to_string().contains("xpui.spa"), "unexpected error: {error:#}");

        apply.join().expect("waiting apply thread exits");
        std::fs::remove_dir_all(&root).expect("cleanup temp config root");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn rejects_a_runtime_directory_symlink_cycle() {
        use std::os::unix::fs::symlink;

        let root = std::env::temp_dir().join(format!(
            "spicetify-runtime-cycle-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock after epoch")
                .as_nanos()
        ));
        let src = root.join("src");
        let nested = src.join("nested");
        std::fs::create_dir_all(&nested).expect("runtime fixture");
        symlink(&src, nested.join("back-to-root")).expect("cycle symlink");

        let error = stage_runtime_dir(&src, &root.join("dst"))
            .expect_err("a cycle must fail before recursively expanding it");
        assert!(error.to_string().contains("symlink cycle"), "unexpected error: {error:#}");

        std::fs::remove_dir_all(root).expect("cleanup runtime fixture");
    }
}
