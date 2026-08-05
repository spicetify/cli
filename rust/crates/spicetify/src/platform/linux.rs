use std::path::{Path, PathBuf};

fn base_dirs() -> directories::BaseDirs {
    directories::BaseDirs::new().expect("unable to determine user directories")
}

fn is_spotify_dir(path: &Path) -> bool {
    path.join("spotify").is_file()
}

pub(crate) fn spicetify_config_dir() -> PathBuf {
    base_dirs().config_dir().join("spicetify")
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

    let home = base_dirs().home_dir().to_path_buf();
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
    let home = base_dirs().home_dir().to_path_buf();

    let snap_home = home.join("snap/spotify/common");
    let home = if snap_home.is_dir() { snap_home } else { home };

    let flatpak_home = home.join(".var/app/com.spotify.Client");
    if flatpak_home.is_dir() {
        return flatpak_home.join("cache/spotify");
    }

    base_dirs().cache_dir().join("spotify")
}

pub(crate) fn portable_config_dir() -> Option<PathBuf> {
    None
}

pub(crate) fn register_url_scheme() {
    let Ok(exe) = std::env::current_exe() else {
        return;
    };
    let Some(base_dirs) = directories::BaseDirs::new() else {
        return;
    };
    let apps_dir = base_dirs.home_dir().join(".local/share/applications");
    if let Err(e) = std::fs::create_dir_all(&apps_dir) {
        tracing::warn!(error = %e, "failed to create applications dir for URL scheme");
        return;
    }
    let desktop = format!(
        "[Desktop Entry]\nType=Application\nName=Spicetify Protocol Handler\nExec={} protocol \
         %u\nStartupNotify=false\nMimeType=x-scheme-handler/spicetify;\nNoDisplay=true\n",
        exe.display()
    );
    if let Err(e) = std::fs::write(apps_dir.join("spicetify-protocol.desktop"), desktop) {
        tracing::warn!(error = %e, "failed to write desktop file for URL scheme");
    }
}
