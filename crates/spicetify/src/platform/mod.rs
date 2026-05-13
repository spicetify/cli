use std::path::{Path, PathBuf};

use dunce;

pub fn default_spicetify_config_root() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Ok(real) = dunce::canonicalize(exe) {
            if let (Some(bin), Some(app)) = (real.parent(), real.parent().and_then(|p| p.parent()))
            {
                let bin_name = bin.file_name().and_then(|s| s.to_str()).unwrap_or_default();
                let app_name = app
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or_default()
                    .to_lowercase();
                if bin_name.eq_ignore_ascii_case("bin") && app_name.starts_with("spicetify") {
                    let portable = app.join("config");
                    if portable.exists() {
                        return portable;
                    }
                }
            }
        }
    }
    platform_config_root()
}

#[cfg(target_os = "windows")]
pub fn default_spotify_data_path() -> PathBuf {
    windows::spotify_data_path()
}

#[cfg(target_os = "windows")]
pub fn default_spotify_exec_path(data: &Path) -> PathBuf {
    windows::spotify_exec_path(data)
}

#[cfg(target_os = "windows")]
pub fn default_spotify_config_path() -> PathBuf {
    windows::spotify_config_path()
}

#[cfg(target_os = "windows")]
fn platform_config_root() -> PathBuf {
    windows::spicetify_config_root()
}

#[cfg(target_os = "linux")]
pub fn default_spotify_data_path() -> PathBuf {
    linux::spotify_data_path()
}

#[cfg(target_os = "linux")]
pub fn default_spotify_exec_path(data: &Path) -> PathBuf {
    linux::spotify_exec_path(data)
}

#[cfg(target_os = "linux")]
pub fn default_spotify_config_path() -> PathBuf {
    linux::spotify_config_path()
}

#[cfg(target_os = "linux")]
fn platform_config_root() -> PathBuf {
    linux::spicetify_config_root()
}

#[cfg(target_os = "macos")]
pub fn default_spotify_data_path() -> PathBuf {
    macos::spotify_data_path()
}

#[cfg(target_os = "macos")]
pub fn default_spotify_exec_path(data: &Path) -> PathBuf {
    macos::spotify_exec_path(data)
}

#[cfg(target_os = "macos")]
pub fn default_spotify_config_path() -> PathBuf {
    macos::spotify_config_path()
}

#[cfg(target_os = "macos")]
fn platform_config_root() -> PathBuf {
    macos::spicetify_config_root()
}

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;
