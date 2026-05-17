use std::{
    net::{TcpStream, ToSocketAddrs}, path::{Path, PathBuf}, process::Command, sync::atomic::{AtomicBool, Ordering}, thread, time::{Duration, Instant}
};

use anyhow::{Context, Result};

use crate::{i18n, logging, release::ReleaseInfo};

const RELEASES_URL: &str = "https://api.github.com/repos/veryboringhwl/app/releases/latest";

static UPDATE_LAUNCHED: AtomicBool = AtomicBool::new(false);

pub fn update_launched() -> bool {
    UPDATE_LAUNCHED.load(Ordering::Acquire)
}

pub fn run() -> Result<()> {
    let current_version = crate::version::current_version();

    if cfg!(not(windows)) {
        logging::warn(i18n::lookup("self_update_windows_only"));
        return Ok(());
    }

    let client = reqwest::blocking::Client::builder()
        .user_agent("spicetify-self-update")
        .build()?;

    logging::info(i18n::lookup_with_args("self_update_checking", &[]));

    let json: serde_json::Value = client
        .get(RELEASES_URL)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .context(i18n::lookup("failed_check_updates"))?
        .json()
        .context(i18n::lookup("failed_parse_release"))?;

    let release = ReleaseInfo::from_json(&json)?;

    if !release.is_update_available(current_version) {
        logging::info(i18n::lookup_with_args(
            "self_update_up_to_date",
            &[("version", current_version)],
        ));
        return Ok(());
    }

    let asset = release.find_installer_err()?;

    logging::info(i18n::lookup_with_args(
        "self_update_downloading",
        &[("version", &release.version), ("current", current_version)],
    ));

    let temp_dir = std::env::temp_dir().join("spicetify-update");
    std::fs::create_dir_all(&temp_dir)?;
    let installer_path = temp_dir.join(&asset.name);

    let response = client.get(&asset.download_url).send()?;
    let bytes = response.bytes()?;
    std::fs::write(&installer_path, &bytes)?;

    logging::info(i18n::lookup_with_args(
        "self_update_installing",
        &[("version", &release.version)],
    ));

    let current_exe = std::env::current_exe().context(i18n::lookup("cannot_get_exe_path"))?;
    let app_dir = current_exe
        .parent()
        .and_then(|p| p.parent())
        .map(PathBuf::from)
        .context(i18n::lookup("cannot_determine_app_dir"))?;

    let install_dir = app_dir.join("install");

    let helper = save_helper(&app_dir)?;

    let status = Command::new(&installer_path)
        .args(["/VERYSILENT", "/update=true", "/NORESTART"])
        .status()
        .context(i18n::lookup("failed_run_installer"))?;

    if !status.success() {
        anyhow::bail!(i18n::lookup("failed_run_installer"));
    }

    shutdown_daemon()?;

    if !install_dir.exists() {
        anyhow::bail!(i18n::lookup_with_args(
            "install_dir_missing",
            &[("path", &install_dir.display().to_string())]
        ));
    }

    let pid = std::process::id();
    std::process::Command::new(&helper)
        .arg(pid.to_string())
        .arg(&app_dir)
        .arg(&install_dir)
        .spawn()
        .map_err(|e| {
            anyhow::anyhow!(
                "{}: {e}",
                i18n::lookup_with_args(
                    "failed_spawn_helper",
                    &[("path", &helper.display().to_string())],
                )
            )
        })?;

    UPDATE_LAUNCHED.store(true, Ordering::Release);

    let _ = std::fs::remove_file(&installer_path);

    logging::info(i18n::lookup_with_args(
        "self_update_launching",
        &[("version", &release.version)],
    ));
    Ok(())
}

fn save_helper(app_dir: &Path) -> Result<PathBuf> {
    let src = app_dir.join("tools").join("auto_update_helper.exe");
    if !src.exists() {
        anyhow::bail!(i18n::lookup_with_args(
            "helper_not_found",
            &[("path", &src.display().to_string())]
        ));
    }
    let dst = std::env::temp_dir()
        .join("spicetify-update")
        .join("auto_update_helper.exe");
    std::fs::create_dir_all(dst.parent().unwrap())?;
    std::fs::copy(&src, &dst)?;
    Ok(dst)
}

fn shutdown_daemon() -> Result<()> {
    let _ = reqwest::blocking::Client::new()
        .post("http://localhost:7967/shutdown")
        .timeout(Duration::from_secs(3))
        .send();

    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(8) {
        if !is_daemon_listening() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(250));
    }

    logging::warn(i18n::lookup("daemon_shutdown_timeout"));

    #[cfg(windows)]
    {
        let our_pid = std::process::id().to_string();
        let output = Command::new("taskkill")
            .args([
                "/IM",
                "spicetify.exe",
                "/F",
                "/FI",
                &format!("PID ne {our_pid}"),
            ])
            .output();
        if let Ok(out) = &output {
            let stderr = String::from_utf8_lossy(&out.stderr);
            if !stderr.is_empty()
                && !stderr.contains("not found")
                && !stderr.contains("no running instance")
            {
                logging::warn(stderr.trim());
            }
        }
    }

    thread::sleep(Duration::from_secs(1));
    Ok(())
}

fn is_daemon_listening() -> bool {
    let addr = match "localhost:7967"
        .to_socket_addrs()
        .ok()
        .and_then(|mut a| a.next())
    {
        Some(a) => a,
        None => return false,
    };
    TcpStream::connect_timeout(&addr, Duration::from_millis(250)).is_ok()
}
