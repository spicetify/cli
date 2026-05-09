use std::path::{Path, PathBuf};

use directories::BaseDirs;

pub fn spotify_data_path() -> PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        let p = PathBuf::from(&appdata).join("Spotify");
        if p.exists() {
            return p;
        }
    }
    BaseDirs::new()
        .map(|b| b.data_dir().join("Spotify"))
        .unwrap_or_else(|| PathBuf::from("."))
}

pub fn spotify_exec_path(data: &Path) -> PathBuf {
    data.join("spotify.exe")
}

pub fn spotify_config_path() -> PathBuf {
    let candidates = {
        let mut v = Vec::new();
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            v.push(PathBuf::from(&local).join("Spotify"));
            let packages = PathBuf::from(&local).join("Packages");
            if let Ok(entries) = std::fs::read_dir(&packages) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with("SpotifyAB.SpotifyMusic") {
                        v.push(entry.path().join("LocalState").join("Spotify"));
                    }
                }
            }
        }
        if let Ok(appdata) = std::env::var("APPDATA") {
            v.push(PathBuf::from(&appdata).join("Spotify"));
        }
        v
    };
    for c in &candidates {
        if c.join("offline.bnk").exists() {
            return c.clone();
        }
    }
    candidates.into_iter().next().unwrap_or_else(|| {
        BaseDirs::new()
            .map(|b| b.config_dir().join("Spotify"))
            .unwrap_or_else(|| PathBuf::from("."))
    })
}

pub fn spicetify_config_root() -> PathBuf {
    if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
        return PathBuf::from(&localappdata).join("Spicetify");
    }
    BaseDirs::new()
        .map(|b| b.data_local_dir().join("Spicetify"))
        .unwrap_or_else(|| PathBuf::from("."))
}
