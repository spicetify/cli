use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;

use windows::Win32::System::Threading::CREATE_NO_WINDOW;

use crate::context::AppContext;
use crate::error::Result;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Protection {
    None,
    Partial,
    Blocked,
}

pub(super) fn uses_staging(ctx: &AppContext) -> bool {
    ctx.spotify_exec.with_file_name("Spotify.dll").is_file()
}

fn staging_directory(ctx: &AppContext) -> Result<PathBuf> {
    anyhow::ensure!(
        !ctx.spotify_data_dir.join("AppxManifest.xml").is_file(),
        "Microsoft Store Spotify updates must be managed through Microsoft Store"
    );
    Ok(ctx.offline_bnk_dir.join("Update"))
}

fn run(path: &Path, action: &str) -> Result<Protection> {
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", include_str!("updates_windows.ps1")])
        .env("SPICETIFY_UPDATE_DIRECTORY", path)
        .env("SPICETIFY_UPDATE_ACTION", action)
        .env_remove("PSModulePath")
        .creation_flags(CREATE_NO_WINDOW.0)
        .output()?;
    anyhow::ensure!(
        output.status.success(),
        "Windows update folder protection failed: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    );
    match String::from_utf8_lossy(&output.stdout).trim() {
        "blocked" => Ok(Protection::Blocked),
        "partial" => Ok(Protection::Partial),
        "allowed" => Ok(Protection::None),
        _ => anyhow::bail!("Windows update folder protection returned an unknown status"),
    }
}

pub(super) fn protection(ctx: &AppContext) -> Result<Protection> {
    run(&staging_directory(ctx)?, "status")
}

pub(super) fn set_blocked(ctx: &AppContext, block: bool) -> Result<()> {
    let blocked = run(&staging_directory(ctx)?, if block { "block" } else { "unblock" })?;
    anyhow::ensure!(
        blocked == if block { Protection::Blocked } else { Protection::None },
        "Windows update folder protection did not reach the requested state"
    );
    tracing::info!("{} Spotify updates", if block { "Disabled" } else { "Enabled" });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn staging_preflight_accepts_a_running_client_without_writing_its_binary() {
        use std::os::windows::fs::OpenOptionsExt;

        let root =
            std::env::temp_dir().join(format!("spicetify-update-preflight-{}", std::process::id()));
        std::fs::create_dir_all(&root).expect("fixture");
        let executable = root.join("Spotify.exe");
        std::fs::write(&executable, b"signed launcher").expect("launcher");
        std::fs::write(root.join("Spotify.dll"), b"signed updater").expect("DLL");
        let cfg = crate::context::Config {
            spotify_exec: Some(executable.clone()),
            offline_bnk_dir: Some(root.clone()),
            ..Default::default()
        };
        let ctx = AppContext::from_config(root.clone(), &cfg).expect("context");
        let running = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(1)
            .open(&executable)
            .expect("running executable lock");
        assert!(std::fs::OpenOptions::new().write(true).open(&executable).is_err());
        super::super::preflight_mutation(&ctx).expect("staging preflight");
        assert_eq!(std::fs::read(&executable).expect("launcher"), b"signed launcher");
        assert_eq!(std::fs::read_dir(ctx.spotify_apps_path()).expect("Apps").count(), 0);
        drop(running);
        std::fs::remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn staging_protection_blocks_writes_and_reverses_without_changing_client_files() {
        let root =
            std::env::temp_dir().join(format!("spicetify-update-acl-{}", std::process::id()));
        std::fs::create_dir_all(&root).expect("fixture");
        let protected_parent = Command::new("powershell.exe")
            .args([
                "-NoProfile", "-NonInteractive", "-Command",
                r#"$ErrorActionPreference = 'Stop'
$path = $env:SPICETIFY_TEST_DIRECTORY
$acl = [System.IO.Directory]::GetAccessControl($path, [System.Security.AccessControl.AccessControlSections]::Access)
$acl.SetAccessRuleProtection($true, $true)
[System.IO.Directory]::SetAccessControl($path, $acl)"#,
            ])
            .env("SPICETIFY_TEST_DIRECTORY", &root)
            .creation_flags(CREATE_NO_WINDOW.0)
            .output()
            .expect("protected parent ACL");
        assert!(protected_parent.status.success(), "{:?}", protected_parent);
        let cfg = crate::context::Config {
            spotify_exec: Some(root.join("Spotify.exe")),
            offline_bnk_dir: Some(root.clone()),
            ..Default::default()
        };
        let ctx = AppContext::from_config(root.clone(), &cfg).expect("context");
        let dll = root.join("Spotify.dll");
        std::fs::write(&ctx.spotify_exec, b"signed launcher").expect("launcher");
        std::fs::write(&dll, b"signed updater").expect("DLL");
        assert!(!super::super::is_blocked(&ctx).expect("missing staging directory"));
        let staging = root.join("Update");
        std::fs::create_dir(&staging).expect("staging");
        super::super::set_blocked(&ctx, true).expect("protect empty directory");
        assert_eq!(
            std::fs::remove_dir(&staging).expect_err("root deletion denied").kind(),
            std::io::ErrorKind::PermissionDenied
        );
        assert_eq!(
            std::fs::rename(&staging, root.join("Update.old"))
                .expect_err("root replacement denied")
                .kind(),
            std::io::ErrorKind::PermissionDenied
        );
        let sibling = root.join("unrelated-cache");
        std::fs::write(&sibling, b"normal cache").expect("sibling writes allowed");
        std::fs::remove_file(&sibling).expect("sibling deletion allowed");
        super::super::set_blocked(&ctx, false).expect("unprotect empty directory");
        let existing = staging.join("cached-update");
        std::fs::write(&existing, b"existing download").expect("cache");
        super::super::set_blocked(&ctx, true).expect("protect");
        assert!(super::super::is_blocked(&ctx).expect("protected state"));
        set_blocked(&ctx, true).expect("idempotent block");
        assert_eq!(
            std::fs::write(staging.join("new-update"), b"new")
                .expect_err("new writes denied")
                .kind(),
            std::io::ErrorKind::PermissionDenied
        );
        assert_eq!(
            std::fs::write(&existing, b"changed").expect_err("existing writes denied").kind(),
            std::io::ErrorKind::PermissionDenied
        );
        assert_eq!(std::fs::read(&dll).expect("DLL unchanged"), b"signed updater");
        std::fs::remove_file(&dll).expect("simulate DLL replacement");
        assert!(super::super::is_blocked(&ctx).expect("protection survives missing DLL"));
        super::super::set_blocked(&ctx, false).expect("unprotect without DLL");
        set_blocked(&ctx, false).expect("idempotent unblock");
        assert_eq!(protection(&ctx).expect("unprotected state"), Protection::None);
        assert_eq!(std::fs::read(&existing).expect("preserved cache"), b"existing download");
        std::fs::write(staging.join("new-update"), b"new").expect("writes restored");
        assert_eq!(
            std::fs::read(&ctx.spotify_exec).expect("launcher unchanged"),
            b"signed launcher"
        );
        std::fs::remove_dir_all(&root).expect("cleanup");
    }
}
