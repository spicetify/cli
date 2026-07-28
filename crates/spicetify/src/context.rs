use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use arc_swap::ArcSwap;
use serde::{Deserialize, Serialize};

use crate::error::Result;
use crate::platform;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub mirror: bool,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spotify_data_dir: Option<PathBuf>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spotify_exec: Option<PathBuf>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offline_bnk_dir: Option<PathBuf>,
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

    fn fixup(&mut self) {
        if let Some(p) = &self.spotify_exec {
            let resolved = platform::coerce_spotify_exec_path(p);
            if !resolved.is_file() {
                tracing::warn!(
                    "spotify_exec path is stale, will use default: {}",
                    resolved.display()
                );
                self.spotify_exec = None;
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct AppContext {
    pub config_file: PathBuf,
    pub config_root: PathBuf,
    pub mirror: bool,
    pub spotify_data_dir: PathBuf,
    pub spotify_exec: PathBuf,
    pub offline_bnk_dir: PathBuf,
}

impl AppContext {
    pub fn from_config(config_root: PathBuf, cfg: &Config) -> Result<Self> {
        let exec_path = match &cfg.spotify_exec {
            Some(p) => platform::coerce_spotify_exec_path(p),
            None => platform::default_spotify_exec(),
        };

        let data_dir = cfg.spotify_data_dir.clone().unwrap_or_else(|| {
            exec_path.parent().map_or_else(platform::default_spotify_data_dir, Path::to_path_buf)
        });

        let offline_bnk_dir =
            cfg.offline_bnk_dir.clone().unwrap_or_else(platform::default_offline_bnk_dir);

        let config_file = config_root.join(Self::config_filename());
        let is_store = data_dir.to_string_lossy().contains("WindowsApps");
        let mirror = cfg.mirror || is_store;

        Ok(Self {
            config_file,
            config_root,
            mirror,
            spotify_data_dir: data_dir,
            spotify_exec: exec_path,
            offline_bnk_dir,
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
    mirror: bool,
    spotify_data_dir: Option<&str>,
    spotify_exec: Option<&str>,
    offline_bnk_dir: Option<&str>,
) -> Result<AppContext> {
    let config_root = platform::default_spicetify_config_dir();
    let config_file = config_root.join("config.toml");
    let mut cfg = Config::load(&config_file)?;

    cfg.mirror = cfg.mirror || mirror;
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
