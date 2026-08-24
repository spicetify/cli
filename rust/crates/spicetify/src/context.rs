use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use arc_swap::ArcSwap;
use serde::{Deserialize, Serialize};

use crate::error::Result;
use crate::platform;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub mirror: bool,

    /// Whether `apply` keeps the daemon installed and running. On by default:
    /// the daemon is what re-applies spicetify after Spotify updates itself.
    #[serde(default = "enabled")]
    pub daemon: bool,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spotify_data_dir: Option<PathBuf>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spotify_exec: Option<PathBuf>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_bnk_dir: Option<PathBuf>,

    /// Whether the user asked for Spotify's self-updater to stay disabled.
    /// The block itself is a patch of Spotify's binary, so a successful
    /// update erases it; this remembers the intent across that, and apply
    /// re-asserts it. Absent means "never asked", which is left alone.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub block_spotify_updates: Option<bool>,
}

const fn enabled() -> bool {
    true
}

impl Default for Config {
    fn default() -> Self {
        Self {
            mirror: false,
            daemon: enabled(),
            spotify_data_dir: None,
            spotify_exec: None,
            offline_bnk_dir: None,
            block_spotify_updates: None,
        }
    }
}

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        if !path.exists() {
            tracing::debug!("config file {} not found, using defaults", path.display());
            return Ok(Self::default());
        }
        let raw = fs::read_to_string(path)?;
        let mut cfg: Self = toml::from_str(&raw)
            .map_err(|e| anyhow::anyhow!("failed to parse config.toml: {e}"))?;
        cfg.fixup();
        Ok(cfg)
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let serialized = toml::to_string_pretty(self)
            .map_err(|e| anyhow::anyhow!("failed to serialize config: {e}"))?;
        fs::write(path, serialized)?;
        Ok(())
    }

    // Self-heals a config written by an older build or copied from another
    // machine: a spotify path that no longer points at a real install is
    // dropped so detection runs, rather than failing apply on a stale path.
    fn fixup(&mut self) {
        if let Some(p) = &self.spotify_exec {
            let resolved = platform::coerce_spotify_exec_path(p);
            if !resolved.is_file() {
                tracing::warn!(
                    "spotify_exec in config.toml points at {}, which does not exist; re-detecting Spotify",
                    resolved.display()
                );
                self.spotify_exec = None;
            }
        }
        if let Some(p) = &self.spotify_data_dir
            && !p.is_dir()
        {
            tracing::warn!(
                "spotify_data_dir in config.toml points at {}, which does not exist; re-detecting Spotify",
                p.display()
            );
            self.spotify_data_dir = None;
        }
    }
}

#[derive(Debug, Clone)]
pub struct AppContext {
    pub config_file: PathBuf,
    pub config_root: PathBuf,
    pub mirror: bool,
    pub daemon: bool,
    pub spotify_data_dir: PathBuf,
    pub spotify_exec: PathBuf,
    pub offline_bnk_dir: PathBuf,
    /// The persisted update policy; see `Config::block_spotify_updates`.
    pub block_spotify_updates: Option<bool>,
}

impl AppContext {
    pub fn from_config(config_root: PathBuf, cfg: &Config) -> Result<Self> {
        let exec_path = match &cfg.spotify_exec {
            Some(p) => platform::coerce_spotify_exec_path(p),
            None => platform::default_spotify_exec(),
        };

        // Only a user-set exec moves the data dir with it. On macOS the two
        // live in different bundle subdirectories, so deriving the default
        // data dir from the default exec would point it at Contents/MacOS.
        let data_dir = cfg.spotify_data_dir.clone().unwrap_or_else(|| match &cfg.spotify_exec {
            Some(_) => exec_path
                .parent()
                .map_or_else(platform::default_spotify_data_dir, Path::to_path_buf),
            None => platform::default_spotify_data_dir(),
        });

        let offline_bnk_dir =
            cfg.offline_bnk_dir.clone().unwrap_or_else(platform::default_offline_bnk_dir);

        let config_file = config_root.join(Self::config_filename());
        #[cfg(windows)]
        let is_store = data_dir.to_string_lossy().contains("WindowsApps");
        #[cfg(not(windows))]
        let is_store = false;
        let mirror = cfg.mirror || is_store;

        Ok(Self {
            config_file,
            config_root,
            mirror,
            daemon: cfg.daemon,
            spotify_data_dir: data_dir,
            spotify_exec: exec_path,
            offline_bnk_dir,
            block_spotify_updates: cfg.block_spotify_updates,
        })
    }

    #[must_use]
    pub fn spotify_apps_path(&self) -> PathBuf {
        self.spotify_data_dir.join("Apps")
    }

    #[must_use]
    pub fn dest_apps_path(&self) -> PathBuf {
        if self.mirror { self.config_root.join("apps") } else { self.spotify_apps_path() }
    }

    #[must_use]
    pub fn daemon_log_file(&self) -> PathBuf {
        self.config_root.join("daemon.log")
    }

    #[must_use]
    pub fn config_filename() -> &'static str {
        "config.toml"
    }
}

#[derive(Debug)]
pub struct SharedContext(ArcSwap<AppContext>);

impl SharedContext {
    #[must_use]
    pub fn new(ctx: AppContext) -> Self {
        Self(ArcSwap::from_pointee(ctx))
    }

    #[must_use]
    pub fn load(&self) -> arc_swap::Guard<Arc<AppContext>> {
        self.0.load()
    }

    #[must_use]
    pub fn load_full(&self) -> Arc<AppContext> {
        self.0.load_full()
    }

    pub fn store(&self, ctx: AppContext) {
        self.0.store(Arc::new(ctx));
    }
}

pub fn build_context(
    mirror: Option<bool>,
    spotify_data_dir: Option<&str>,
    spotify_exec: Option<&str>,
    offline_bnk_dir: Option<&str>,
) -> Result<AppContext> {
    let config_root = platform::default_spicetify_config_dir();
    let config_file = config_root.join("config.toml");
    let mut cfg = Config::load(&config_file)?;

    if let Some(v) = mirror {
        cfg.mirror = v;
    }
    if let Some(v) = spotify_data_dir {
        cfg.spotify_data_dir = Some(PathBuf::from(v));
    }
    if let Some(v) = spotify_exec {
        cfg.spotify_exec = Some(PathBuf::from(v));
    }
    if let Some(v) = offline_bnk_dir {
        cfg.offline_bnk_dir = Some(PathBuf::from(v));
    }

    AppContext::from_config(config_root, &cfg)
}

pub fn build_fresh_context() -> Result<AppContext> {
    let config_root = platform::default_spicetify_config_dir();
    AppContext::from_config(config_root, &Config::default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_update_policy_round_trips_and_stays_absent_until_asked() {
        // The block is a patch of Spotify's binary, so a successful update
        // erases it; config is the only place the intent can survive. An
        // untouched config must stay silent rather than claiming a policy
        // the user never set.
        let quiet = toml::to_string_pretty(&Config::default()).expect("serializes");
        assert!(!quiet.contains("block_spotify_updates"), "an unset policy is not written");

        let blocked = Config { block_spotify_updates: Some(true), ..Config::default() };
        let text = toml::to_string_pretty(&blocked).expect("serializes");
        assert!(text.contains("block_spotify_updates = true"));
        let parsed: Config = toml::from_str(&text).expect("parses");
        assert_eq!(parsed.block_spotify_updates, Some(true));

        // A config written before this field existed parses as "never asked".
        let legacy: Config = toml::from_str("mirror = false\ndaemon = true\n").expect("parses");
        assert_eq!(legacy.block_spotify_updates, None);
    }

    #[test]
    fn fixup_drops_a_stale_data_dir_so_detection_can_run() {
        let mut cfg = Config {
            spotify_data_dir: Some(PathBuf::from(
                "/spicetify-nonexistent/Spotify.app/Contents/Resources",
            )),
            spotify_exec: Some(PathBuf::from(
                "/spicetify-nonexistent/Spotify.app/Contents/MacOS/Spotify",
            )),
            ..Config::default()
        };
        // Neither path exists: the stale-config shape that shadowed detection
        // on a machine with Spotify in ~/Applications. A bogus root keeps the
        // test independent of where Spotify actually is on this machine.
        cfg.fixup();
        assert!(cfg.spotify_data_dir.is_none(), "a data dir that is not a real install is dropped");
        assert!(cfg.spotify_exec.is_none(), "a stale exec is dropped");
    }

    #[test]
    fn fixup_keeps_a_data_dir_that_exists() {
        let dir = std::env::temp_dir().join(format!("spicetify-cfg-{}", std::process::id()));
        fs::create_dir_all(&dir).expect("temp data dir");
        let mut cfg = Config { spotify_data_dir: Some(dir.clone()), ..Config::default() };
        cfg.fixup();
        assert_eq!(cfg.spotify_data_dir.as_deref(), Some(dir.as_path()));
        fs::remove_dir_all(&dir).expect("cleanup");
    }
}
