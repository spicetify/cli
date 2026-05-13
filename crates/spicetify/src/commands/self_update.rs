use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

use crate::{i18n, logging};

const RELEASES_URL: &str = "https://api.github.com/repos/veryboringhwl/app/releases/latest";

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

    let release: serde_json::Value = client
        .get(RELEASES_URL)
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .context(i18n::lookup("failed_check_updates"))?
        .json()
        .context(i18n::lookup("failed_parse_release"))?;

    let tag = release["tag_name"].as_str().unwrap_or("v0.0.0");
    let latest = tag.strip_prefix('v').unwrap_or(tag);

    if latest == current_version {
        logging::info(i18n::lookup_with_args(
            "self_update_up_to_date",
            &[("version", current_version)],
        ));
        return Ok(());
    }

    let asset_name = format!("installer-{latest}-windows-amd64.exe");
    let download_url = release["assets"]
        .as_array()
        .and_then(|assets| {
            assets
                .iter()
                .find(|a| a["name"].as_str() == Some(&asset_name))
                .and_then(|a| a["browser_download_url"].as_str())
        })
        .with_context(|| i18n::lookup_with_args("no_release_asset", &[("name", &asset_name)]))?;

    logging::info(i18n::lookup_with_args(
        "self_update_downloading",
        &[("version", latest), ("current", current_version)],
    ));

    let temp_dir = std::env::temp_dir().join("spicetify-update");
    std::fs::create_dir_all(&temp_dir)?;
    let installer_path = temp_dir.join(&asset_name);

    let response = client.get(download_url).send()?;
    let bytes = response.bytes()?;
    std::fs::write(&installer_path, &bytes)?;

    logging::info(i18n::lookup_with_args(
        "self_update_installing",
        &[("version", latest)],
    ));

    let current_exe = std::env::current_exe().context(i18n::lookup("cannot_get_exe_path"))?;
    let app_dir = current_exe
        .parent()
        .and_then(|p| p.parent())
        .map(PathBuf::from)
        .context(i18n::lookup("cannot_determine_app_dir"))?;

    let helper = find_helper(&app_dir)?;

    shutdown_daemon()?;

    let pid = std::process::id();
    std::process::Command::new(&helper)
        .arg(pid.to_string())
        .arg(&installer_path)
        .arg(&app_dir)
        .spawn()
        .context(i18n::lookup("failed_spawn_helper"))?;

    logging::info(i18n::lookup_with_args(
        "self_update_launching",
        &[("version", latest)],
    ));
    Ok(())
}

fn find_helper(app_dir: &Path) -> Result<PathBuf> {
    let helper = app_dir.join("tools").join("auto_update_helper.exe");
    if helper.exists() {
        return Ok(helper);
    }

    Err(anyhow::anyhow!(i18n::lookup_with_args(
        "helper_not_found",
        &[("path", &helper.display().to_string())]
    )))
}

fn shutdown_daemon() -> Result<()> {
    if reqwest::blocking::Client::new()
        .post("http://localhost:7967/shutdown")
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .is_ok()
    {
        std::thread::sleep(std::time::Duration::from_millis(500));
    }
    Ok(())
}
