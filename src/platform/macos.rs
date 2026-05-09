use std::path::{Path, PathBuf};

use directories::BaseDirs;

pub fn spotify_data_path() -> PathBuf {
    let candidates = vec![
        PathBuf::from("/Applications/Spotify.app/Contents/Resources"),
        BaseDirs::new()
            .map(|b| {
                b.home_dir()
                    .join("Applications/Spotify.app/Contents/Resources")
            })
            .unwrap_or_default(),
    ];
    candidates
        .into_iter()
        .find(|p| p.exists())
        .unwrap_or_else(|| PathBuf::from("/Applications/Spotify.app/Contents/Resources"))
}

pub fn spotify_exec_path(data: &Path) -> PathBuf {
    data.join("Spotify")
}

pub fn spotify_config_path() -> PathBuf {
    BaseDirs::new()
        .map(|b| b.config_dir().join("Spotify"))
        .unwrap_or_else(|| PathBuf::from("."))
}

pub fn spicetify_config_root() -> PathBuf {
    BaseDirs::new()
        .map(|b| b.config_dir().join("Spicetify"))
        .unwrap_or_else(|| PathBuf::from("."))
}
