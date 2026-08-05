use std::path::PathBuf;

fn base_dirs() -> directories::BaseDirs {
    directories::BaseDirs::new().expect("unable to determine user directories")
}

// ~/.config/spicetify, not the platform config dir (~/Library/Application
// Support): this is where the Go CLI keeps config, modules and classmaps, and
// state written by either binary has to be readable by the other.
pub(crate) fn spicetify_config_dir() -> PathBuf {
    base_dirs().home_dir().join(".config").join("spicetify")
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

// macOS ships the v8 snapshot inside the CEF framework bundle rather than
// beside the app resources, so neither the data dir nor PersistentCache
// contains it.
pub(crate) fn snapshot_dirs() -> Vec<PathBuf> {
    vec![
        PathBuf::from("/Applications/Spotify.app/Contents/Frameworks")
            .join("Chromium Embedded Framework.framework")
            .join("Resources"),
    ]
}

pub(crate) fn portable_config_dir() -> Option<PathBuf> {
    None
}

// URL schemes are declared in the app bundle's Info.plist
// (CFBundleURLTypes); there is nothing to register at runtime.
pub(crate) fn register_url_scheme() {}
