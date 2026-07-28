use std::path::PathBuf;

pub(crate) fn spicetify_config_dir() -> PathBuf {
    directories::BaseDirs::new()
        .expect("unable to determine home directory")
        .config_dir()
        .join("spicetify")
}

pub(crate) const fn spotify_binary_name() -> &'static str {
    "Spotify"
}

pub(crate) fn spotify_data_dir() -> PathBuf {
    PathBuf::from("/Applications/Spotify.app/Contents/Resources")
}

pub(crate) fn spotify_exec() -> PathBuf {
    spotify_data_dir().join(spotify_binary_name())
}

pub(crate) fn offline_bnk_dir() -> PathBuf {
    directories::BaseDirs::new()
        .expect("unable to determine home directory")
        .data_dir()
        .join("Spotify")
        .join("PersistentCache")
}

pub(crate) fn portable_config_dir() -> Option<PathBuf> {
    None
}
