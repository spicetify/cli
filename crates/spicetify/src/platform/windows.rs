use std::path::{Path, PathBuf};
use std::sync::LazyLock;

enum Variant {
    Normal,
    MsStore,
}

static VARIANT: LazyLock<Variant> = LazyLock::new(|| {
    static MS_STORE_CHECK: LazyLock<bool> = LazyLock::new(|| {
        std::process::Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "(Get-AppxPackage | Where-Object -Property Name -Eq \
                 \"SpotifyAB.SpotifyMusic\").InstallLocation",
            ])
            .output()
            .is_ok_and(|o| {
                let dir = String::from_utf8_lossy(&o.stdout).trim().to_string();
                !dir.is_empty() && Path::new(&dir).join("Spotify.exe").is_file()
            })
    });

    if std::env::var("APPDATA")
        .is_ok_and(|d| Path::new(&d).join("Spotify").join("Spotify.exe").is_file())
    {
        return Variant::Normal;
    }

    if *MS_STORE_CHECK {
        return Variant::MsStore;
    }
    Variant::Normal
});

pub(crate) fn spicetify_config_dir() -> PathBuf {
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

pub(crate) const fn spotify_binary_name() -> &'static str {
    "Spotify.exe"
}

pub(crate) fn spotify_data_dir() -> PathBuf {
    match &*VARIANT {
        Variant::Normal => {
            if let Ok(roaming) = std::env::var("APPDATA") {
                PathBuf::from(roaming).join("Spotify")
            } else {
                PathBuf::from("C:/Users/Default/AppData/Roaming/Spotify")
            }
        }
        Variant::MsStore => {
            static FAMILY_NAME: LazyLock<Option<String>> = LazyLock::new(|| {
                let output = std::process::Command::new("powershell.exe")
                    .args([
                        "-NoProfile",
                        "-NonInteractive",
                        "(Get-AppxPackage | Where-Object -Property Name -Eq \
                         \"SpotifyAB.SpotifyMusic\").PackageFamilyName",
                    ])
                    .output()
                    .ok()?;
                let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if name.is_empty() { None } else { Some(name) }
            });

            let name =
                FAMILY_NAME.clone().expect("MsStore variant set but no family name available");
            if let Ok(local) = std::env::var("LOCALAPPDATA") {
                PathBuf::from(local).join("Packages").join(name).join("LocalState").join("Spotify")
            } else {
                PathBuf::from("C:/Users/Default/AppData/Local/Spotify")
            }
        }
    }
}

pub(crate) fn spotify_exec() -> PathBuf {
    match &*VARIANT {
        Variant::Normal => {
            if let Ok(roaming) = std::env::var("APPDATA") {
                PathBuf::from(roaming).join("Spotify").join("Spotify.exe")
            } else {
                PathBuf::from("C:/Users/Default/AppData/Roaming/Spotify/Spotify.exe")
            }
        }
        Variant::MsStore => {
            static INSTALL_DIR: LazyLock<Option<PathBuf>> = LazyLock::new(|| {
                let output = std::process::Command::new("powershell.exe")
                    .args([
                        "-NoProfile",
                        "-NonInteractive",
                        "(Get-AppxPackage | Where-Object -Property Name -Eq \
                         \"SpotifyAB.SpotifyMusic\").InstallLocation",
                    ])
                    .output()
                    .ok()?;
                let dir = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if dir.is_empty() || !Path::new(&dir).join("Spotify.exe").is_file() {
                    return None;
                }
                Some(PathBuf::from(dir))
            });

            INSTALL_DIR
                .clone()
                .expect("MsStore variant set but no install dir available")
                .join("Spotify.exe")
        }
    }
}

pub(crate) fn offline_bnk_dir() -> PathBuf {
    match &*VARIANT {
        Variant::Normal => {
            if let Ok(local) = std::env::var("LOCALAPPDATA") {
                PathBuf::from(local).join("Spotify")
            } else {
                PathBuf::from("C:/Users/Default/AppData/Local/Spotify")
            }
        }
        Variant::MsStore => {
            static FAMILY_NAME: LazyLock<Option<String>> = LazyLock::new(|| {
                let output = std::process::Command::new("powershell.exe")
                    .args([
                        "-NoProfile",
                        "-NonInteractive",
                        "(Get-AppxPackage | Where-Object -Property Name -Eq \
                         \"SpotifyAB.SpotifyMusic\").PackageFamilyName",
                    ])
                    .output()
                    .ok()?;
                let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if name.is_empty() { None } else { Some(name) }
            });

            let name =
                FAMILY_NAME.clone().expect("MsStore variant set but no family name available");
            if let Ok(local) = std::env::var("LOCALAPPDATA") {
                PathBuf::from(local).join("Packages").join(name).join("LocalState").join("Spotify")
            } else {
                PathBuf::from("C:/Users/Default/AppData/Local/Spotify")
            }
        }
    }
}

pub(crate) fn portable_config_dir() -> Option<PathBuf> {
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
