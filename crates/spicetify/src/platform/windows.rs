use std::path::PathBuf;

pub(super) fn spicetify_config_root() -> PathBuf {
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        return PathBuf::from(local).join("Spicetify");
    }
    directories::UserDirs::new()
        .and_then(|u| u.home_dir().to_path_buf().into())
        .expect("unable to determine home directory")
        .join("AppData")
        .join("Local")
        .join("Spicetify")
}

pub(super) fn default_spotify_install_dir() -> PathBuf {
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        let ms_store = PathBuf::from(&local).join("Spotify");
        if ms_store.join(spotify_binary_name()).is_file() {
            return ms_store;
        }
    }
    if let Ok(roaming) = std::env::var("APPDATA") {
        return PathBuf::from(roaming).join("Spotify");
    }
    PathBuf::from("C:/Users/Default/AppData/Roaming/Spotify")
}

pub(super) const fn spotify_binary_name() -> &'static str {
    "Spotify.exe"
}

pub(super) fn spotify_data_path() -> PathBuf {
    default_spotify_install_dir()
}

pub(super) fn offline_bnk_dir() -> PathBuf {
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        return PathBuf::from(local).join("Spotify");
    }
    PathBuf::from("C:/Users/Default/AppData/Local/Spotify")
}
