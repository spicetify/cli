use std::path::{Path, PathBuf};

fn home_dir() -> PathBuf {
    directories::UserDirs::new()
        .map(|u| u.home_dir().to_path_buf())
        .expect("unable to determine home directory")
}

fn is_spotify_dir(path: &Path) -> bool {
    path.join("spotify").is_file()
}

pub(crate) fn spicetify_config_dir() -> PathBuf {
    directories::BaseDirs::new()
        .map_or_else(|| home_dir().join(".config/spicetify"), |d| d.config_dir().join("spicetify"))
}

pub(crate) const fn spotify_binary_name() -> &'static str {
    "spotify"
}

pub(crate) fn spotify_data_dir() -> PathBuf {
    let candidates = [
        "/opt/spotify/",
        "/opt/spotify/spotify-client/",
        "/usr/share/spotify/",
        "/usr/share/spotify-client/",
        "/usr/libexec/spotify/",
        "/var/lib/flatpak/app/com.spotify.Client/x86_64/stable/active/files/extra/share/spotify/",
    ];

    for &candidate in &candidates {
        let p = Path::new(candidate);
        if is_spotify_dir(p) {
            return p.to_path_buf();
        }
    }

    let home = home_dir();
    let p = home.join(
        ".local/share/flatpak/app/com.spotify.Client/x86_64/stable/active/files/extra/share/\
         spotify/",
    );
    if is_spotify_dir(&p) {
        return p;
    }
    let p = home.join(".local/share/spotify-launcher/install/usr/share/spotify/");
    if is_spotify_dir(&p) {
        return p;
    }

    PathBuf::from("/opt/spotify")
}

pub(crate) fn spotify_exec() -> PathBuf {
    spotify_data_dir().join(spotify_binary_name())
}

pub(crate) fn offline_bnk_dir() -> PathBuf {
    let home = home_dir();

    let snap_home = home.join("snap/spotify/common");
    let home = if snap_home.is_dir() { snap_home } else { home };

    let flatpak_home = home.join(".var/app/com.spotify.Client");
    if flatpak_home.is_dir() {
        return flatpak_home.join("cache/spotify");
    }

    directories::BaseDirs::new()
        .map_or_else(|| home.join(".cache/spotify"), |d| d.cache_dir().join("spotify"))
}

pub(crate) fn portable_config_dir() -> Option<PathBuf> {
    None
}
