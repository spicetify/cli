use std::path::PathBuf;
use std::process::Command;
use std::sync::LazyLock;

use tracing;

fn base_dirs() -> directories::BaseDirs {
    directories::BaseDirs::new().expect("unable to determine user directories")
}

struct SpotifyPackage {
    family_name: String,
    install_location: PathBuf,
}

static SPOTIFY_PACKAGE: LazyLock<Option<SpotifyPackage>> = LazyLock::new(|| {
    let output = match Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "$p=Get-AppxPackage -Name 'SpotifyAB.SpotifyMusic'; if($p){$p.InstallLocation; \
             $p.PackageFamilyName}",
        ])
        .output()
    {
        Ok(o) => o,
        Err(e) => {
            tracing::warn!("failed to run Get-AppxPackage: {e}");
            return None;
        }
    };

    if !output.status.success() {
        tracing::debug!("Get-AppxPackage exited with non-zero status");
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut lines = stdout.lines().map(str::trim).filter(|l| !l.is_empty());

    let Some(path) = lines.next() else {
        tracing::debug!("SpotifyAB.SpotifyMusic package not found via Get-AppxPackage");
        return None;
    };

    let Some(family) = lines.next() else {
        tracing::warn!("Get-AppxPackage returned install location but no family name");
        return None;
    };

    let exe = PathBuf::from(path).join("Spotify.exe");
    if !exe.is_file() {
        tracing::warn!("Spotify.exe not found in Store install dir: {}", exe.display());
        return None;
    }

    tracing::info!("detected Spotify (Store) at {}", path);
    Some(SpotifyPackage { family_name: family.to_string(), install_location: PathBuf::from(path) })
});

enum Variant {
    Normal,
    MsStore,
}

static VARIANT: LazyLock<Variant> = LazyLock::new(|| {
    if SPOTIFY_PACKAGE.is_some() {
        tracing::info!("selected MsStore variant");
        return Variant::MsStore;
    }

    let dirs = directories::BaseDirs::new();
    if dirs.is_some_and(|d| {
        let p = d.data_dir().join("Spotify").join("Spotify.exe");
        let exists = p.is_file();
        if exists {
            tracing::info!("detected Spotify (Desktop) at {}", p.display());
        }
        exists
    }) {
        tracing::info!("selected Normal variant");
        return Variant::Normal;
    }

    tracing::warn!("could not detect Spotify installation, defaulting to Normal variant");
    Variant::Normal
});

pub(crate) fn spicetify_config_dir() -> PathBuf {
    base_dirs().data_local_dir().join("Spicetify")
}

pub(crate) const fn spotify_binary_name() -> &'static str {
    "Spotify.exe"
}

pub(crate) fn spotify_data_dir() -> PathBuf {
    match &*VARIANT {
        Variant::Normal => base_dirs().data_dir().join("Spotify"),
        Variant::MsStore => SPOTIFY_PACKAGE
            .as_ref()
            .expect("MsStore variant set but no install dir available")
            .install_location
            .clone(),
    }
}

pub(crate) fn spotify_exec() -> PathBuf {
    match &*VARIANT {
        Variant::Normal => base_dirs().data_dir().join("Spotify").join("Spotify.exe"),
        Variant::MsStore => {
            base_dirs().data_local_dir().join("Microsoft").join("WindowsApps").join("Spotify.exe")
        }
    }
}

pub(crate) fn offline_bnk_dir() -> PathBuf {
    match &*VARIANT {
        Variant::Normal => base_dirs().data_local_dir().join("Spotify"),
        Variant::MsStore => {
            let pkg = SPOTIFY_PACKAGE.as_ref().expect("MsStore variant set but no package info");
            base_dirs()
                .data_local_dir()
                .join("Packages")
                .join(&pkg.family_name)
                .join("LocalState")
                .join("Spotify")
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

pub(crate) fn register_url_scheme() {
    use windows_registry::CURRENT_USER;

    let Ok(exe) = std::env::current_exe() else {
        return;
    };
    let scheme_key = r"Software\Classes\spicetify";
    let key = match CURRENT_USER.create(scheme_key) {
        Ok(k) => k,
        Err(e) => {
            tracing::warn!(error = %e, "failed to create spicetify URL scheme registry key");
            return;
        }
    };
    if let Err(e) = key.set_string("", "URL:spicetify") {
        tracing::warn!(error = %e, "failed to set spicetify URL scheme default value");
    }
    if let Err(e) = key.set_string("URL Protocol", "") {
        tracing::warn!(error = %e, "failed to set spicetify URL Protocol value");
    }
    let cmd_key = match CURRENT_USER.create(format!("{scheme_key}\\shell\\open\\command")) {
        Ok(k) => k,
        Err(e) => {
            tracing::warn!(error = %e, "failed to create spicetify URL scheme command key");
            return;
        }
    };
    if let Err(e) = cmd_key.set_string("", format!("\"{}\" protocol \"%1\"", exe.display())) {
        tracing::warn!(error = %e, "failed to set spicetify URL scheme command");
    }
}
