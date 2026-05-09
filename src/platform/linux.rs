use std::path::{Path, PathBuf};

use directories::BaseDirs;

pub fn spotify_data_path() -> PathBuf {
    let mut candidates = vec![
        PathBuf::from("/opt/spotify"),
        PathBuf::from("/opt/spotify/spotify-client"),
        PathBuf::from("/usr/share/spotify"),
        PathBuf::from("/usr/libexec/spotify"),
        PathBuf::from(
            "/var/lib/flatpak/app/com.spotify.Client/x86_64/stable/active/files/extra/share/spotify",
        ),
    ];
    if let Some(base) = BaseDirs::new() {
        candidates.push(
            base.home_dir()
                .join(".local/share/flatpak/app/com.spotify.Client/x86_64/stable/active/files/extra/share/spotify"),
        );
        candidates.push(
            base.home_dir()
                .join(".local/share/spotify-launcher/install/usr/share/spotify"),
        );
    }
    candidates
        .into_iter()
        .find(|p| spotify_exec_path(p).exists())
        .unwrap_or_else(|| PathBuf::from("/opt/spotify"))
}

pub fn spotify_exec_path(data: &Path) -> PathBuf {
    data.join("spotify")
}

pub fn spotify_config_path() -> PathBuf {
    BaseDirs::new()
        .map(|b| b.config_dir().join("spotify"))
        .unwrap_or_else(|| PathBuf::from("."))
}

pub fn spicetify_config_root() -> PathBuf {
    BaseDirs::new()
        .map(|b| b.config_dir().join("spicetify"))
        .unwrap_or_else(|| PathBuf::from("."))
}
