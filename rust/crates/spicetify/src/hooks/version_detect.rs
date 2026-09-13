use std::path::Path;
use std::process::Command;
use std::sync::LazyLock;

use regex::Regex;

use crate::context::AppContext;
use crate::error::Result;

static VERSION_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(\d+\.\d+\.\d+)").expect("valid regex"));

/// The oldest client `apply` will touch. Below it the index.html and bundle
/// layout predate the patcher and the exposure patches, and a failed apply
/// past the backup rename leaves a client with no servable xpui.
pub const MIN_SUPPORTED_SPOTIFY: semver::Version = semver::Version::new(1, 2, 80);

pub fn spotify_supported(version: &semver::Version) -> bool {
    *version >= MIN_SUPPORTED_SPOTIFY
}

pub fn detect_spotify_version(ctx: &AppContext) -> Result<semver::Version> {
    let exe = &ctx.spotify_exec;
    let version_str = detect_version(exe)?;
    let version_str = sanitize_version(&version_str);

    let version = semver::Version::parse(&version_str)
        .map_err(|e| anyhow::anyhow!("failed to parse Spotify version '{version_str}': {e}"))?;
    Ok(version)
}

fn sanitize_version(raw: &str) -> String {
    VERSION_RE
        .captures(raw)
        .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
        .unwrap_or_else(|| raw.trim().to_string())
}

#[cfg(target_os = "macos")]
fn detect_version(exec_path: &Path) -> Result<String> {
    let app_base = exec_path.parent().and_then(|p| p.parent()).and_then(|p| p.parent());

    if let Some(bundle) = app_base
        && bundle.extension().is_some_and(|e| e == "app")
    {
        let output = Command::new("mdls")
            .args(["-name", "kMDItemVersion", "-raw", &bundle.to_string_lossy()])
            .output()
            .map_err(|e| anyhow::anyhow!("failed to run mdls: {e}"))?;
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            // Treat "(null)" from mdls as no result and use the Info.plist fallback
            if !version.is_empty() && !version.eq_ignore_ascii_case("(null)") {
                return Ok(version);
            }
        }
    }

    // Falls back to the bundle's Info.plist, still derived from the resolved
    // executable. No hardcoded location: if the exec is not bundle-shaped
    // there is nothing trustworthy to read, and guessing a path produces a
    // confidently wrong answer instead of an honest failure.
    let Some(bundle) = app_base.filter(|p| p.extension().is_some_and(|e| e == "app")) else {
        return Err(anyhow::anyhow!(
            "unable to detect Spotify version: {} is not inside a .app bundle",
            exec_path.display()
        ));
    };
    let info_plist = bundle.join("Contents").join("Info.plist");
    let output = Command::new("plutil")
        .args(["-extract", "CFBundleShortVersionString", "raw", "-o", "-"])
        .arg(&info_plist)
        .output()
        .map_err(|e| anyhow::anyhow!("failed to read {}: {e}", info_plist.display()))?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !version.is_empty() {
            return Ok(version);
        }
    }

    Err(anyhow::anyhow!("unable to detect Spotify version on macOS"))
}

#[cfg(target_os = "linux")]
fn detect_version(exec_path: &Path) -> Result<String> {
    if let Ok(output) = Command::new(exec_path).arg("--version").output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(version) =
            VERSION_RE.captures(&stdout).and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
        {
            return Ok(version);
        }
    }

    let re = Regex::new(r"^Version:\s*(\S+)").expect("valid regex");
    if let Ok(output) = Command::new("dpkg").args(["-s", "spotify-client"]).output() {
        let text = String::from_utf8_lossy(&output.stdout);
        if let Some(version) =
            re.captures(&text).and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
        {
            return Ok(version);
        }
    }

    if let Ok(output) =
        Command::new("rpm").args(["-q", "--queryformat", "%{VERSION}", "spotify-client"]).output()
    {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !version.is_empty() {
            return Ok(version);
        }
    }

    Err(anyhow::anyhow!("unable to detect Spotify version on Linux"))
}

#[cfg(windows)]
fn detect_version(exec_path: &Path) -> Result<String> {
    // PowerShell takes seconds to start; there is nothing for it to read
    // when the executable is not there, so answer without spawning it.
    if !exec_path.is_file() {
        return Err(anyhow::anyhow!(
            "unable to detect Spotify version: {} does not exist",
            exec_path.display()
        ));
    }
    let ps_script =
        format!("(Get-Item -LiteralPath '{}').VersionInfo.ProductVersion", exec_path.display());

    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &ps_script])
        .output()
        .map_err(|e| anyhow::anyhow!("failed to run powershell: {e}"))?;

    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !version.is_empty() {
            return Ok(version);
        }
    }

    Err(anyhow::anyhow!("unable to detect Spotify version on Windows"))
}

#[cfg(test)]
mod floor_tests {
    use super::*;

    #[cfg(target_os = "macos")]
    #[test]
    fn reads_version_from_info_plist_when_spotlight_has_no_metadata() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock")
            .as_nanos();
        let root = std::env::temp_dir()
            .join(format!("spicetify-version-detect-{}-{unique}", std::process::id()));
        let contents = root.join("Spotify.app").join("Contents");
        let executable = contents.join("MacOS").join("Spotify");
        std::fs::create_dir_all(executable.parent().expect("executable parent"))
            .expect("create fake Spotify bundle");
        std::fs::write(
            contents.join("Info.plist"),
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleShortVersionString</key>
    <string>1.2.97.270</string>
</dict>
</plist>
"#,
        )
        .expect("write Info.plist");

        let detected = detect_version(&executable);
        std::fs::remove_dir_all(&root).expect("remove fake Spotify bundle");

        assert_eq!(detected.expect("detect version from Info.plist"), "1.2.97.270");
    }

    #[test]
    fn the_floor_admits_1_2_80_and_refuses_older() {
        assert!(spotify_supported(&semver::Version::new(1, 2, 80)));
        assert!(spotify_supported(&semver::Version::new(1, 2, 84)));
        assert!(spotify_supported(&semver::Version::new(1, 3, 0)));
        assert!(!spotify_supported(&semver::Version::new(1, 2, 79)));
        assert!(!spotify_supported(&semver::Version::new(1, 2, 45)));
    }
}
