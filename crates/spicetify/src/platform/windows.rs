use std::path::PathBuf;

pub(crate) fn spicetify_config_root() -> PathBuf {
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        return PathBuf::from(local).join("Spicetify");
    }
    directories::UserDirs::new()
        .expect("unable to determine home directory")
        .home_dir()
        .to_path_buf()
        .join("AppData")
        .join("Local")
        .join("Spicetify")
}

pub(crate) fn spotify_install_dir() -> PathBuf {
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

pub(crate) const fn spotify_binary_name() -> &'static str {
    "Spotify.exe"
}

pub(crate) fn spotify_data_path() -> PathBuf {
    spotify_install_dir()
}

pub(crate) fn offline_bnk_dir() -> PathBuf {
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        return PathBuf::from(local).join("Spotify");
    }
    PathBuf::from("C:/Users/Default/AppData/Local/Spotify")
}

pub(crate) fn portable_config_root() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let real = std::fs::canonicalize(exe).ok()?;
    let bin = real.parent()?;
    let app = bin.parent()?;
    let bin_is_bin = bin.file_name()?.eq_ignore_ascii_case("bin");
    let app_starts_with_spicetify =
        app.file_name()?.to_str().is_some_and(|s| s.starts_with("spicetify"));
    if bin_is_bin && app_starts_with_spicetify {
        let p = app.join("config");
        if p.exists() {
            return Some(p);
        }
    }
    None
}
