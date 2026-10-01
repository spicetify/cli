//! Spicetify v2 leftovers: the client it patched, the backup that undoes it,
//! and the files its release archive left in folders v3 also uses.
//!
//! v2's `apply` deletes Spotify's `Apps` folder and copies in extracted
//! `xpui/` and `login/` folders, so a v2-patched client has no `xpui.spa`.
//! Its `backup` keeps the stock `.spa` files in a state folder and records
//! the Spotify version they came from in `config-xpui.ini`.

use std::path::{Path, PathBuf};

/// A v2 backup holding the stock `.spa` files.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct V2Backup {
    pub dir: PathBuf,
    /// The Spotify version v2 recorded for the backup, when it recorded one.
    pub spotify_version: Option<String>,
}

/// Whether a v2 apply can be undone.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum V2Plan {
    /// Restore from this backup.
    Restore(V2Backup),
    /// v2 left no backup to restore from.
    NoBackup,
    /// The backup is of another Spotify version than the one installed, so
    /// restoring it would pair this client with the wrong app files.
    VersionMismatch { backup: PathBuf, backup_version: String, installed: String },
}

/// The v2 backup on this machine, if it still holds `xpui.spa`.
pub(crate) fn find_backup() -> Option<V2Backup> {
    let dir = state_dir()?.join("Backup");
    if !dir.join("xpui.spa").is_file() {
        return None;
    }
    let spotify_version = config_dir().and_then(|dir| backup_version(&dir.join("config-xpui.ini")));
    Some(V2Backup { dir, spotify_version })
}

/// Decides whether `backup` can undo the v2 apply: not when it was recorded
/// for another Spotify version line than `installed`.
pub(crate) fn plan(backup: Option<V2Backup>, installed: Option<&semver::Version>) -> V2Plan {
    let Some(backup) = backup else { return V2Plan::NoBackup };
    if let (Some(recorded), Some(installed)) = (backup.spotify_version.as_deref(), installed) {
        let installed = format!("{}.{}.{}", installed.major, installed.minor, installed.patch);
        if version_line(recorded) != installed {
            return V2Plan::VersionMismatch {
                backup: backup.dir.clone(),
                backup_version: recorded.to_string(),
                installed,
            };
        }
    }
    V2Plan::Restore(backup)
}

/// Undoes a v2 apply in `apps` as v2's `restore` does: removes the extracted
/// `xpui/` and `login/` folders and copies the backed-up `.spa` files back.
/// The backup itself is left as it is.
pub(crate) fn restore_files(apps: &Path, backup: &V2Backup) -> std::io::Result<()> {
    for folder in ["xpui", "login"] {
        match std::fs::remove_dir_all(apps.join(folder)) {
            Err(e) if e.kind() != std::io::ErrorKind::NotFound => return Err(e),
            _ => {}
        }
    }
    for entry in std::fs::read_dir(&backup.dir)? {
        let path = entry?.path();
        if path.extension().is_some_and(|ext| ext == "spa")
            && let Some(name) = path.file_name()
        {
            let _ = std::fs::copy(&path, apps.join(name))?;
        }
    }
    Ok(())
}

/// Whether `dir` holds v2's release archive (it shipped `jsHelper/` next to
/// `css-map.json`), which v3 never writes. On Windows v3's config root is the
/// folder v2's installer used for its binaries.
pub(crate) fn has_v2_archive(dir: &Path) -> bool {
    dir.join("jsHelper").is_dir()
}

/// `major.minor.patch` of a Spotify version such as `1.3.0.277.g5441bb3e`.
fn version_line(version: &str) -> String {
    version.split('.').take(3).collect::<Vec<_>>().join(".")
}

/// The `version` key of the `[Backup]` section of v2's `config-xpui.ini`.
fn backup_version(ini: &Path) -> Option<String> {
    let text = std::fs::read_to_string(ini).ok()?;
    let mut in_backup = false;
    for line in text.lines() {
        let line = line.trim();
        if let Some(section) = line.strip_prefix('[').and_then(|s| s.strip_suffix(']')) {
            in_backup = section.trim() == "Backup";
        } else if in_backup
            && let Some((key, value)) = line.split_once('=')
            && key.trim() == "version"
        {
            let value = value.trim();
            return (!value.is_empty()).then(|| value.to_string());
        }
    }
    None
}

fn env_dir(name: &str) -> Option<PathBuf> {
    std::env::var_os(name).filter(|value| !value.is_empty()).map(PathBuf::from)
}

fn home() -> Option<PathBuf> {
    directories::BaseDirs::new().map(|dirs| dirs.home_dir().to_path_buf())
}

/// v2's config folder: `$SPICETIFY_CONFIG`, else `%APPDATA%\spicetify`,
/// `$XDG_CONFIG_HOME/spicetify` or `~/.config/spicetify`.
fn config_dir() -> Option<PathBuf> {
    if let Some(dir) = env_dir("SPICETIFY_CONFIG") {
        return Some(dir);
    }
    #[cfg(windows)]
    let parent = env_dir("APPDATA");
    #[cfg(target_os = "linux")]
    let parent = env_dir("XDG_CONFIG_HOME").or_else(|| home().map(|home| home.join(".config")));
    #[cfg(not(any(windows, target_os = "linux")))]
    let parent = home().map(|home| home.join(".config"));
    parent.map(|parent| parent.join("spicetify"))
}

/// v2's state folder, which holds `Backup/`: `$SPICETIFY_STATE`, else
/// `%APPDATA%\spicetify`, `$XDG_STATE_HOME/spicetify` or `~/.local/state/spicetify`.
fn state_dir() -> Option<PathBuf> {
    if let Some(dir) = env_dir("SPICETIFY_STATE") {
        return Some(dir);
    }
    #[cfg(windows)]
    let parent = env_dir("APPDATA");
    #[cfg(target_os = "linux")]
    let parent =
        env_dir("XDG_STATE_HOME").or_else(|| home().map(|home| home.join(".local").join("state")));
    #[cfg(not(any(windows, target_os = "linux")))]
    let parent = home().map(|home| home.join(".local").join("state"));
    parent.map(|parent| parent.join("spicetify"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(label: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("spicetify-legacy-{label}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    fn v2_patched(root: &Path) -> (PathBuf, V2Backup) {
        let apps = root.join("Apps");
        std::fs::create_dir_all(apps.join("xpui/extensions")).expect("xpui");
        std::fs::write(apps.join("xpui/extensions/marketplace.js"), "v2").expect("extension");
        std::fs::create_dir_all(apps.join("login")).expect("login");
        let backup = root.join("Backup");
        std::fs::create_dir_all(&backup).expect("backup");
        std::fs::write(backup.join("xpui.spa"), "stock xpui").expect("xpui.spa");
        std::fs::write(backup.join("login.spa"), "stock login").expect("login.spa");
        std::fs::create_dir_all(backup.join("Extracted")).expect("non-spa content");
        (apps, V2Backup { dir: backup, spotify_version: Some("1.3.0.277.g5441bb3e".to_string()) })
    }

    #[test]
    fn restores_the_stock_archives_in_place_of_v2s_folders() {
        let root = temp("restore");
        let (apps, backup) = v2_patched(&root);
        let installed = semver::Version::new(1, 3, 0);

        assert_eq!(plan(Some(backup.clone()), Some(&installed)), V2Plan::Restore(backup.clone()));
        restore_files(&apps, &backup).expect("restore");
        assert_eq!(std::fs::read_to_string(apps.join("xpui.spa")).expect("xpui"), "stock xpui");
        assert_eq!(std::fs::read_to_string(apps.join("login.spa")).expect("login"), "stock login");
        assert!(!apps.join("xpui").exists(), "v2's patched client is gone");
        assert!(!apps.join("login").exists());
        assert!(!apps.join("Extracted").exists(), "only .spa files are copied");
        assert!(backup.dir.join("xpui.spa").is_file(), "v2's backup is left as it was");
        std::fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn refuses_a_backup_of_another_spotify_version() {
        let root = temp("mismatch");
        let (apps, backup) = v2_patched(&root);
        let installed = semver::Version::new(1, 3, 1);

        assert_eq!(
            plan(Some(backup.clone()), Some(&installed)),
            V2Plan::VersionMismatch {
                backup: backup.dir.clone(),
                backup_version: "1.3.0.277.g5441bb3e".to_string(),
                installed: "1.3.1".to_string(),
            }
        );
        std::fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn plans_a_restore_when_either_version_is_unknown_and_reports_a_missing_backup() {
        let root = temp("unknown");
        let (apps, mut backup) = v2_patched(&root);
        backup.spotify_version = None;
        assert_eq!(
            plan(Some(backup.clone()), Some(&semver::Version::new(1, 3, 0))),
            V2Plan::Restore(backup.clone())
        );
        backup.spotify_version = Some("1.3.0.277".to_string());
        assert_eq!(plan(Some(backup.clone()), None), V2Plan::Restore(backup), "installed unknown");
        assert_eq!(plan(None, None), V2Plan::NoBackup);
        let _ = apps;
        std::fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn reads_the_backup_version_from_v2s_config() {
        let root = temp("ini");
        let ini = root.join("config-xpui.ini");
        std::fs::write(
            &ini,
            "[Setting]\nversion = ignored\n\n[Backup]\nwith    = 2.45.0\nversion = 1.3.0.277.g5441bb3e\n\n[Patch]\n",
        )
        .expect("ini");
        assert_eq!(backup_version(&ini).as_deref(), Some("1.3.0.277.g5441bb3e"));
        std::fs::write(&ini, "[Backup]\nversion =\n").expect("cleared");
        assert_eq!(backup_version(&ini), None, "v2 clears it when the backup is removed");
        assert_eq!(backup_version(&root.join("missing.ini")), None);
        std::fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn recognises_v2s_release_archive() {
        let root = temp("archive");
        assert!(!has_v2_archive(&root));
        std::fs::create_dir_all(root.join("jsHelper")).expect("jsHelper");
        assert!(has_v2_archive(&root));
        std::fs::remove_dir_all(&root).expect("cleanup");
    }
}
