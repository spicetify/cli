use std::path::PathBuf;
use std::process::{Command, Stdio};

use crate::context::AppContext;
use crate::error::Result;

pub(crate) fn is_spotify_running(image: &str) -> bool {
    #[cfg(windows)]
    {
        Command::new("tasklist")
            .args(["/FI", &format!("IMAGENAME eq {image}"), "/FO", "CSV", "/NH"])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
            .is_ok_and(|out| {
                let stdout = String::from_utf8_lossy(&out.stdout);
                stdout.contains(image)
            })
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("pgrep")
            .args(["-x", image])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|s| s.success())
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("sh")
            .args(["-c", &format!("ps aux | grep '{image}' | grep -v grep")])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|s| s.success())
    }
}

pub fn spawn_detached(ctx: &AppContext) -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        spawn_macos(ctx)
    }
    #[cfg(windows)]
    {
        spawn_windows(ctx)
    }
    #[cfg(target_os = "linux")]
    {
        spawn_linux(ctx)
    }
}

#[cfg(target_os = "macos")]
fn spawn_macos(_ctx: &AppContext) -> Result<()> {
    let _ = Command::new("open")
        .args(["-a", "/Applications/Spotify.app", "--args"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| anyhow::anyhow!("failed to launch Spotify via open: {e}"))?;
    tracing::info!("Spotify launched via open -a /Applications/Spotify.app");
    Ok(())
}

#[cfg(windows)]
fn spawn_windows(ctx: &AppContext) -> Result<()> {
    let local_appdata = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let appx_exe =
        PathBuf::from(&local_appdata).join("Microsoft").join("WindowsApps").join("Spotify.exe");

    if appx_exe.is_file() {
        let dest_apps = ctx.dest_apps_path();
        let ps_cmd =
            format!("& \"{}\" --app-directory=\"{}\"", appx_exe.display(), dest_apps.display());

        let _ = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", &ps_cmd])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| anyhow::anyhow!("failed to launch AppX Spotify: {e}"))?;
        tracing::info!("Spotify (AppX) launched via powershell.exe");
        Ok(())
    } else {
        spawn_binary(ctx)
    }
}

#[cfg(target_os = "linux")]
fn spawn_linux(ctx: &AppContext) -> Result<()> {
    spawn_binary(ctx)
}

#[cfg(any(windows, target_os = "linux"))]
fn spawn_binary(ctx: &AppContext) -> Result<()> {
    let exe = &ctx.spotify_exec_path;
    if !exe.is_file() {
        return Err(anyhow::anyhow!("Spotify executable not found at {}", exe.display()));
    }

    let mut cmd = Command::new(exe);
    let _ = cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());

    #[cfg(target_os = "linux")]
    {
        use std::os::unix::process::CommandExt;
        let _ = cmd.process_group(0);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;

        use windows::Win32::System::Threading::{CREATE_NEW_PROCESS_GROUP, CREATE_NO_WINDOW};
        let _ = cmd.creation_flags((CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP).0);
    }

    let _ = cmd
        .spawn()
        .map_err(|e| anyhow::anyhow!("process spawn failed for {}: {e}", exe.display()))?;
    tracing::info!("Spotify process spawned and detached");
    Ok(())
}

pub fn force_kill_spotify(ctx: &AppContext) {
    let image = ctx.spotify_exec_path.file_name().and_then(|s| s.to_str()).unwrap_or("Spotify");

    if !is_spotify_running(image) {
        return;
    }

    #[cfg(windows)]
    {
        tracing::info!("force-killing Spotify processes");
        let result = Command::new("taskkill")
            .args(["/F", "/IM", image, "/T"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        match result {
            Ok(s) if !s.success() => {
                tracing::debug!("taskkill /F /IM {image} exited with {s}");
            }
            Err(e) => tracing::warn!(error = %e, "failed to run taskkill"),
            _ => {}
        }
    }

    #[cfg(target_os = "linux")]
    {
        tracing::info!("force-killing Spotify processes");

        let exe_path = ctx.spotify_exec_path.to_string_lossy();

        let by_name = Command::new("pkill")
            .args(["-KILL", "-x", image])
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .output();

        let by_full = Command::new("pkill")
            .args(["-KILL", "-f", &exe_path])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();

        match by_name {
            Ok(out) if !out.status.success() => {
                let stderr = String::from_utf8_lossy(&out.stderr);
                tracing::debug!("pkill -KILL -x {image}: {stderr}");
            }
            Err(e) => tracing::warn!(error = %e, "failed to run pkill -KILL -x"),
            _ => {}
        }
        match by_full {
            Ok(s) if !s.success() => {
                tracing::debug!("pkill -KILL -f {exe_path} exited with {s}");
            }
            Err(e) => tracing::warn!(error = %e, "failed to run pkill -KILL -f"),
            _ => {}
        }
    }

    #[cfg(target_os = "macos")]
    {
        tracing::info!("force-killing Spotify processes");
        let result = Command::new("pkill")
            .args(["-x", "-KILL", image])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        match result {
            Ok(s) if !s.success() => tracing::debug!("pkill -x -KILL {image} exited with {s}"),
            Err(e) => tracing::warn!(error = %e, "failed to run pkill"),
            _ => {}
        }
    }
}
