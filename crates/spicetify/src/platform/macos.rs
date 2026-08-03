use std::path::PathBuf;

fn base_dirs() -> directories::BaseDirs {
    directories::BaseDirs::new().expect("unable to determine user directories")
}

pub(crate) fn spicetify_config_dir() -> PathBuf {
    base_dirs().config_dir().join("spicetify")
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
    base_dirs().data_dir().join("Spotify").join("PersistentCache")
}

pub(crate) fn portable_config_dir() -> Option<PathBuf> {
    None
}

// URL schemes are declared in the app bundle's Info.plist
// (CFBundleURLTypes); there is nothing to register at runtime.
pub(crate) fn register_url_scheme() {}
