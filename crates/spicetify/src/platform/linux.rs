use std::path::{Path, PathBuf};

fn home_dir() -> PathBuf {
    directories::UserDirs::new()
        .and_then(|u| u.home_dir().to_path_buf().into())
        .expect("unable to determine home directory")
}

fn is_spotify_install_dir(path: &Path) -> bool {
    path.join(spotify_binary_name()).is_file()
}

pub(super) fn spicetify_config_root() -> PathBuf {
    if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
        return PathBuf::from(xdg).join("spicetify");
    }
    home_dir().join(".config").join("spicetify")
}

pub(super) fn default_spotify_install_dir() -> PathBuf {
    let candidates = [
        "/opt/spotify/",
        "/opt/spotify/spotify-client/",
        "/usr/share/spotify/",
        "/usr/libexec/spotify/",
        "/var/lib/flatpak/app/com.spotify.Client/x86_64/stable/active/files/extra/share/spotify/",
    ];

    for &candidate in &candidates {
        let p = Path::new(candidate);
        if is_spotify_install_dir(p) {
            return p.to_path_buf();
        }
    }

    let home = home_dir();
    let p = home.join(
        ".local/share/flatpak/app/com.spotify.Client/x86_64/stable/active/files/extra/share/\
         spotify/",
    );
    if is_spotify_install_dir(&p) {
        return p;
    }
    let p = home.join(".local/share/spotify-launcher/install/usr/share/spotify/");
    if is_spotify_install_dir(&p) {
        return p;
    }

    PathBuf::from("/opt/spotify")
}

pub(super) const fn spotify_binary_name() -> &'static str {
    "spotify"
}

pub(super) fn spotify_data_path() -> PathBuf {
    default_spotify_install_dir()
}

pub(super) fn offline_bnk_dir() -> PathBuf {
    spotify_data_path().join("Data")
}
