use std::path::{Path, PathBuf};

fn base_dirs() -> directories::BaseDirs {
    directories::BaseDirs::new().expect("unable to determine user directories")
}

// ~/.config/spicetify, not the platform config dir (~/Library/Application
// Support): this is where the Go CLI keeps config, modules and classmaps, and
// state written by either binary has to be readable by the other.
pub(crate) fn spicetify_config_dir() -> PathBuf {
    base_dirs().home_dir().join(".config").join("spicetify")
}

pub(crate) const fn spotify_binary_name() -> &'static str {
    "Spotify"
}

/// The Spotify.app bundle. Spotify's installer drops it in `~/Applications`
/// for a non-admin install and in `/Applications` for a system one, so
/// neither can be assumed: guessing `/Applications` when the app is in
/// `~/Applications` makes `apply` write under a directory the user cannot
/// touch and fail with a bare "Permission denied". Prefer the standard
/// location, fall back to the per-user one, then to Launch Services, and
/// finally name `/Applications` so an error still points somewhere real.
fn spotify_app_bundle() -> PathBuf {
    let candidates =
        [PathBuf::from("/Applications/Spotify.app"), base_dirs().home_dir().join("Applications/Spotify.app")];
    resolve_bundle(&candidates, spotlight_spotify)
}

fn resolve_bundle(candidates: &[PathBuf], spotlight: impl Fn() -> Option<PathBuf>) -> PathBuf {
    candidates
        .iter()
        .find(|p| p.exists())
        .cloned()
        .or_else(spotlight)
        .unwrap_or_else(|| PathBuf::from("/Applications/Spotify.app"))
}

/// Asks Launch Services where Spotify actually is, for the case where it sits
/// in neither common location. Best-effort: a missing `mdfind` or a disabled
/// Spotlight just means the caller uses its own fallback.
fn spotlight_spotify() -> Option<PathBuf> {
    let out = std::process::Command::new("mdfind")
        .arg("kMDItemCFBundleIdentifier == 'com.spotify.client'")
        .output()
        .ok()?;
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(PathBuf::from)
        .find(|p| p.extension().is_some_and(|ext| ext == "app") && p.exists())
}

pub(crate) fn spotify_data_dir() -> PathBuf {
    spotify_app_bundle().join("Contents").join("Resources")
}

pub(crate) fn spotify_exec() -> PathBuf {
    spotify_app_bundle().join("Contents").join("MacOS").join(spotify_binary_name())
}

pub(crate) fn offline_bnk_dir() -> PathBuf {
    base_dirs().data_dir().join("Spotify").join("PersistentCache")
}

// macOS ships the v8 snapshot inside the CEF framework bundle rather than
// beside the app resources, so neither the data dir nor PersistentCache
// contains it. Derived from the resolved data dir (`<bundle>/Contents/
// Resources`) rather than re-detected, so a `spotify_data_dir` override in
// config.toml moves the snapshot lookup with it instead of stranding it at
// the default location.
pub(crate) fn snapshot_dirs(data_dir: &Path) -> Vec<PathBuf> {
    // <bundle>/Contents/Resources -> <bundle>
    let Some(bundle) = data_dir.parent().and_then(Path::parent) else { return Vec::new() };
    vec![
        bundle
            .join("Contents")
            .join("Frameworks")
            .join("Chromium Embedded Framework.framework")
            .join("Resources"),
    ]
}

pub(crate) fn portable_config_dir() -> Option<PathBuf> {
    None
}

const LSREGISTER: &str = "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";
const BUNDLE_ID: &str = "app.spicetify.protocol";

/// Installs the bundle that owns `spicetify://`. A bare executable cannot
/// claim a URL scheme on macOS, and the activation arrives as an Apple Event
/// rather than argv, so the handler is an `AppleScript` applet with an
/// `open location` handler that shells back to this binary.
pub(crate) fn register_url_scheme() {
    match install_protocol_handler() {
        Ok(bundle) => tracing::info!("registered spicetify:// to {}", bundle.display()),
        Err(e) => tracing::warn!(error = %e, "could not register the spicetify:// URL handler"),
    }
}

fn install_protocol_handler() -> crate::error::Result<PathBuf> {
    let exe = std::env::current_exe()?;
    let apps = base_dirs().home_dir().join("Applications");
    std::fs::create_dir_all(&apps)?;

    let bundle = apps.join("Spicetify.app");
    let log = spicetify_config_dir().join("protocol.log");

    let source = std::env::temp_dir().join("spicetify-protocol.applescript");
    std::fs::write(&source, applescript(&exe, &log))?;

    if bundle.exists() {
        std::fs::remove_dir_all(&bundle)?;
    }
    run("/usr/bin/osacompile", &["-o".as_ref(), bundle.as_os_str(), source.as_os_str()])?;
    if let Err(e) = std::fs::remove_file(&source) {
        tracing::debug!(error = %e, "could not remove the temporary applescript");
    }

    declare_url_scheme(&bundle.join("Contents").join("Info.plist"))?;
    run(LSREGISTER, &["-f".as_ref(), bundle.as_os_str()])?;

    Ok(bundle)
}

/// `quoted form of` is `AppleScript`'s shell escaping, so a hostile URI cannot
/// break out of the command. The CLI validates the URI itself.
fn applescript(exe: &Path, log: &Path) -> String {
    format!(
        "on open location this_URL\n\
         \tset cli to {}\n\
         \tset logFile to {}\n\
         \tdo shell script cli & \" protocol \" & quoted form of this_URL & \" >> \" & logFile & \" 2>&1\"\n\
         end open location\n",
        applescript_quoted(&exe.to_string_lossy()),
        applescript_quoted(&log.to_string_lossy()),
    )
}

/// An `AppleScript` string literal holding a shell-quoted path.
fn applescript_quoted(raw: &str) -> String {
    format!("\"'{}'\"", raw.replace('\\', "\\\\").replace('"', "\\\"").replace('\'', "'\\''"))
}

fn declare_url_scheme(plist: &Path) -> crate::error::Result<()> {
    let entries = [
        "Add :CFBundleURLTypes array",
        "Add :CFBundleURLTypes:0 dict",
        "Add :CFBundleURLTypes:0:CFBundleURLName string app.spicetify.protocol",
        "Add :CFBundleURLTypes:0:CFBundleURLSchemes array",
        "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string spicetify",
        "Add :LSUIElement bool true",
    ];
    // The bundle is rebuilt from scratch each time, and osacompile writes no
    // identifier of its own, so every key is added rather than set.
    let identifier = format!("Add :CFBundleIdentifier string {BUNDLE_ID}");
    for entry in entries.into_iter().chain(std::iter::once(identifier.as_str())) {
        run("/usr/libexec/PlistBuddy", &["-c".as_ref(), entry.as_ref(), plist.as_os_str()])?;
    }
    Ok(())
}

fn run(program: &str, args: &[&std::ffi::OsStr]) -> crate::error::Result<()> {
    let out = std::process::Command::new(program).args(args).output()?;
    if !out.status.success() {
        anyhow::bail!("{program} failed: {}", String::from_utf8_lossy(&out.stderr).trim());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolve_bundle_prefers_an_existing_candidate() {
        let dir = std::env::temp_dir().join(format!("spicetify-bundle-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp bundle");
        let missing = dir.join("nope/Spotify.app");
        let present = dir.clone();
        // A sentinel from spotlight proves it was never consulted: the
        // existing candidate short-circuits before the fallback runs.
        let sentinel = PathBuf::from("/sentinel/Spotify.app");
        let got = resolve_bundle(&[missing, present.clone()], || Some(sentinel.clone()));
        assert_eq!(got, present);
        std::fs::remove_dir_all(&dir).expect("cleanup");
    }

    #[test]
    fn resolve_bundle_falls_back_to_spotlight_then_applications() {
        let missing = PathBuf::from("/definitely/not/here/Spotify.app");
        let spotlit = PathBuf::from("/Users/someone/Applications/Spotify.app");
        assert_eq!(resolve_bundle(std::slice::from_ref(&missing), || Some(spotlit.clone())), spotlit);
        assert_eq!(
            resolve_bundle(&[missing], || None),
            PathBuf::from("/Applications/Spotify.app"),
            "with nothing found, the error still names a real path",
        );
    }

    #[test]
    fn snapshot_dir_follows_the_data_dir_bundle() {
        // A config override sends the snapshot lookup to the same bundle, not
        // the hardcoded /Applications one.
        let data = PathBuf::from("/Users/me/Applications/Spotify.app/Contents/Resources");
        let dirs = snapshot_dirs(&data);
        assert_eq!(
            dirs,
            vec![PathBuf::from(
                "/Users/me/Applications/Spotify.app/Contents/Frameworks/Chromium Embedded Framework.framework/Resources"
            )]
        );
    }
}
