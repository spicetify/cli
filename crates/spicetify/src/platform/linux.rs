use std::path::{Path, PathBuf};

fn home_dir() -> PathBuf {
    directories::UserDirs::new()
        .map(|u| u.home_dir().to_path_buf())
        .expect("unable to determine home directory")
}

fn is_spotify_install_dir(path: &Path) -> bool {
    path.join("spotify").is_file()
}

pub(crate) fn spicetify_config_root() -> PathBuf {
    if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
        return PathBuf::from(xdg).join("spicetify");
    }
    home_dir().join(".config").join("spicetify")
}

pub(crate) fn spotify_install_dir() -> PathBuf {
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

pub(crate) const fn spotify_binary_name() -> &'static str {
    "spotify"
}

pub(crate) fn spotify_data_path() -> PathBuf {
    spotify_install_dir()
}

pub(crate) fn offline_bnk_dir() -> PathBuf {
    spotify_data_path().join("Data")
}

pub(crate) fn portable_config_root() -> Option<PathBuf> {
    None
}
