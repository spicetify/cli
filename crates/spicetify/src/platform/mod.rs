use std::path::{Path, PathBuf};

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

#[must_use]
pub fn default_spicetify_config_root() -> PathBuf {
    if let Ok(root) = std::env::var("SPICETIFY_CONFIG_ROOT") {
        let p = PathBuf::from(root);
        if p.is_absolute() {
            return p;
        }
    }
    if let Some(p) = portable_config_root() {
        return p;
    }
    platform_config_root()
}

#[must_use]
pub fn default_spotify_data_path() -> PathBuf {
    #[cfg(windows)]
    {
        windows::spotify_data_path()
    }
    #[cfg(target_os = "macos")]
    {
        macos::spotify_data_path()
    }
    #[cfg(target_os = "linux")]
    {
        linux::spotify_data_path()
    }
}

#[must_use]
pub fn default_spotify_exec_path() -> PathBuf {
    #[cfg(windows)]
    {
        windows::default_spotify_install_dir().join(windows::spotify_binary_name())
    }
    #[cfg(target_os = "macos")]
    {
        macos::default_spotify_install_dir().join(macos::spotify_binary_name())
    }
    #[cfg(target_os = "linux")]
    {
        linux::default_spotify_install_dir().join(linux::spotify_binary_name())
    }
}

#[must_use]
pub fn resolve_spotify_exec_path(raw: &Path) -> PathBuf {
    if raw.is_file() {
        return raw.to_path_buf();
    }
    if raw.is_dir() {
        return raw.join(binary_name());
    }
    if raw.file_name().is_some_and(|n| n == std::ffi::OsStr::new(binary_name())) {
        return raw.to_path_buf();
    }
    raw.join(binary_name())
}

fn binary_name() -> &'static str {
    #[cfg(windows)]
    {
        "Spotify.exe"
    }
    #[cfg(target_os = "macos")]
    {
        "Spotify"
    }
    #[cfg(target_os = "linux")]
    {
        "spotify"
    }
}

#[must_use]
pub fn default_offline_bnk_dir() -> PathBuf {
    #[cfg(windows)]
    {
        windows::offline_bnk_dir()
    }
    #[cfg(target_os = "macos")]
    {
        macos::offline_bnk_dir()
    }
    #[cfg(target_os = "linux")]
    {
        linux::offline_bnk_dir()
    }
}

#[cfg(windows)]
fn platform_config_root() -> PathBuf {
    windows::spicetify_config_root()
}

#[cfg(target_os = "macos")]
fn platform_config_root() -> PathBuf {
    macos::spicetify_config_root()
}

#[cfg(target_os = "linux")]
fn platform_config_root() -> PathBuf {
    linux::spicetify_config_root()
}

#[cfg(windows)]
fn portable_config_root() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let real = dunce::canonicalize(exe).ok()?;
    let bin = real.parent()?;
    let app = bin.parent()?;
    let bin_name = bin.file_name()?.to_ascii_lowercase();
    let app_name = app.file_name()?.to_ascii_lowercase();
    let bin_is_bin = bin_name == "bin";
    let app_starts_with_spicetify = app_name.to_str().is_some_and(|s| s.starts_with("spicetify"));
    if bin_is_bin && app_starts_with_spicetify {
        let p = app.join("config");
        if p.exists() {
            return Some(p);
        }
    }
    None
}

#[cfg(not(windows))]
fn portable_config_root() -> Option<PathBuf> {
    None
}
