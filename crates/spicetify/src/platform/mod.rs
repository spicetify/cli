use std::ffi::OsStr;
use std::path::{Path, PathBuf};

#[cfg(target_os = "linux")]
#[path = "linux.rs"]
mod imp;
#[cfg(target_os = "macos")]
#[path = "macos.rs"]
mod imp;
#[cfg(target_os = "windows")]
#[path = "windows.rs"]
mod imp;

#[must_use]
pub fn default_spicetify_config_root() -> PathBuf {
    imp::portable_config_root().unwrap_or_else(imp::spicetify_config_root)
}

#[must_use]
pub fn default_spotify_data_path() -> PathBuf {
    imp::spotify_data_path()
}

#[must_use]
pub fn default_spotify_exec_path() -> PathBuf {
    imp::spotify_install_dir().join(imp::spotify_binary_name())
}

#[must_use]
pub fn coerce_spotify_exec_path(raw: &Path) -> PathBuf {
    let binary = imp::spotify_binary_name();
    if raw.is_file() {
        return raw.to_path_buf();
    }
    if raw.is_dir() {
        return raw.join(binary);
    }
    if raw.file_name().is_some_and(|n| n == OsStr::new(binary)) {
        return raw.to_path_buf();
    }
    raw.join(binary)
}

#[must_use]
pub fn default_offline_bnk_dir() -> PathBuf {
    imp::offline_bnk_dir()
}
