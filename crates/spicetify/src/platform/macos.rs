use std::path::PathBuf;

pub(crate) fn spicetify_config_root() -> PathBuf {
    directories::BaseDirs::new()
        .expect("unable to determine home directory")
        .config_dir()
        .join("spicetify")
}

pub(crate) fn spotify_install_dir() -> PathBuf {
    PathBuf::from("/Applications/Spotify.app/Contents/MacOS")
}

pub(crate) const fn spotify_binary_name() -> &'static str {
    "Spotify"
}

pub(crate) fn spotify_data_path() -> PathBuf {
    directories::UserDirs::new()
        .expect("unable to determine home directory")
        .home_dir()
        .to_path_buf()
        .join("Library")
        .join("Application Support")
        .join("Spotify")
}

pub(crate) fn offline_bnk_dir() -> PathBuf {
    spotify_data_path().join("Data")
}

pub(crate) fn portable_config_root() -> Option<PathBuf> {
    None
}
