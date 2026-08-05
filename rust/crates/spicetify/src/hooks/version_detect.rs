use std::path::Path;
use std::process::Command;
use std::sync::LazyLock;

use regex::Regex;

use crate::context::AppContext;
use crate::error::Result;

static VERSION_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(\d+\.\d+\.\d+)").expect("valid regex"));

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
            if !version.is_empty() {
                return Ok(version);
            }
        }
    }

    let output = Command::new("sh")
        .args([
            "-c",
            "defaults read /Applications/Spotify.app/Contents/Info CFBundleShortVersionString",
        ])
        .output()
        .map_err(|e| anyhow::anyhow!("failed to read Info.plist: {e}"))?;

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
