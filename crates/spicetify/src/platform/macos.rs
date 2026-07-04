use std::path::PathBuf;

pub(super) fn spicetify_config_root() -> PathBuf {
    if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
        return PathBuf::from(xdg).join("spicetify");
    }
    directories::UserDirs::new()
        .and_then(|u| u.home_dir().to_path_buf().into())
        .expect("unable to determine home directory")
        .join(".config")
        .join("spicetify")
}

pub(super) fn default_spotify_install_dir() -> PathBuf {
    directories::UserDirs::new()
        .and_then(|u| u.home_dir().to_path_buf().into())
        .expect("unable to determine home directory")
        .join("Library")
        .join("Application Support")
        .join("Spotify")
}

pub(super) const fn spotify_binary_name() -> &'static str {
    "Spotify"
}

pub(super) fn spotify_data_path() -> PathBuf {
    default_spotify_install_dir()
}

pub(super) fn offline_bnk_dir() -> PathBuf {
    spotify_data_path().join("Data")
}
