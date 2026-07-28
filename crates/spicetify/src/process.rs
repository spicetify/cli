use std::process::{Command, Stdio};

use crate::context::AppContext;
use crate::error::Result;

pub(crate) fn process_running(name: &str) -> bool {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        Command::new("pgrep")
            .args(["-x", name])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|s| s.success())
    }
    #[cfg(windows)]
    {
        Command::new("tasklist")
            .args(["/FI", &format!("ImageName eq {name}"), "/NH"])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
            .is_ok_and(|o| {
                !o.stdout.is_empty()
                    && !o
                        .stdout
                        .windows(b"No tasks are running".len())
                        .any(|w| w == b"No tasks are running")
            })
    }
}

pub(crate) fn kill_image(name: &str) {
    #[cfg(any(target_os = "linux", target_os = "macos"))]
    {
        match Command::new("pkill")
            .args(["-x", name])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
        {
            Ok(s) if s.success() => {}
            Ok(s) => tracing::warn!(%name, %s, "pkill exited with non-zero status"),
            Err(e) => tracing::warn!(%name, error = %e, "failed to run pkill"),
        }
    }
    #[cfg(windows)]
    {
        match Command::new("taskkill")
            .args(["/F", "/IM", name])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
        {
            Ok(s) if s.success() => {}
            Ok(s) => tracing::warn!(%name, %s, "taskkill exited with non-zero status"),
            Err(e) => tracing::warn!(%name, error = %e, "failed to run taskkill"),
        }
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
    use std::path::PathBuf;

    use directories::BaseDirs;
    let local_appdata =
        BaseDirs::new().map_or_else(PathBuf::new, |d| d.data_local_dir().to_path_buf());
    let appx_exe = local_appdata.join("Microsoft").join("WindowsApps").join("Spotify.exe");

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
    use fork::{Fork, fork, setsid, waitpid};

    let exe = &ctx.spotify_exec;
    if !exe.is_file() {
        return Err(anyhow::anyhow!("Spotify executable not found at {}", exe.display()));
    }

    // Double-fork + setsid: the grandchild is reparented to init,
    // completely removed from spicetify's process tree.
    match fork().map_err(|e| anyhow::anyhow!("first fork failed: {e}"))? {
        Fork::Child => {
            // Intermediate child: create new session, no controlling terminal.
            // If setsid fails we're still detached from spicetify and
            // the second fork will orphan us anyway — safe to continue.
            if let Err(e) = setsid() {
                tracing::warn!(error = %e, "setsid failed, continuing detached anyway");
            }
            match fork() {
                Ok(Fork::Child) => {
                    // Grandchild: fully detached (PPID = 1). Exec Spotify.
                    use std::os::unix::process::CommandExt;
                    let mut cmd = Command::new(exe);
                    let _ = cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
                    let err = cmd.exec();
                    drop(err);
                    std::process::exit(1);
                }
                Ok(Fork::Parent(_)) => {
                    // Intermediate child exits immediately.
                    std::process::exit(0);
                }
                Err(e) => {
                    eprintln!("second fork failed: {e}");
                    std::process::exit(1);
                }
            }
        }
        Fork::Parent(pid) => {
            // Original process: reap intermediate child, no zombie.
            loop {
                match waitpid(pid) {
                    Ok(_) => break,
                    Err(ref e) if e.kind() == std::io::ErrorKind::Interrupted => {}
                    Err(e) => {
                        tracing::warn!("waitpid for intermediate child failed: {e}");
                        break;
                    }
                }
            }
            tracing::info!("Spotify process spawned and detached via double-fork");
            Ok(())
        }
    }
}

#[cfg(windows)]
fn spawn_binary(ctx: &AppContext) -> Result<()> {
    let exe = &ctx.spotify_exec;
    if !exe.is_file() {
        return Err(anyhow::anyhow!("Spotify executable not found at {}", exe.display()));
    }

    let mut cmd = Command::new(exe);
    let _ = cmd.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());

    {
        use std::os::windows::process::CommandExt;

        use windows::Win32::System::Threading::{
            CREATE_NEW_PROCESS_GROUP, CREATE_NO_WINDOW, DETACHED_PROCESS
        };
        let _ =
            cmd.creation_flags((CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS).0);
    }

    let child = cmd
        .spawn()
        .map_err(|e| anyhow::anyhow!("process spawn failed for {}: {e}", exe.display()))?;
    std::mem::forget(child);
    tracing::info!("Spotify process spawned and detached");
    Ok(())
}

pub fn force_kill_spotify(ctx: &AppContext) {
    let image = ctx.spotify_exec.file_name().and_then(|s| s.to_str()).unwrap_or("Spotify");

    if !process_running(image) {
        return;
    }

    tracing::info!("force-killing Spotify processes");
    kill_image(image);
}
