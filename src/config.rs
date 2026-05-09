use std::{
    fs, path::{Path, PathBuf}
};

use anyhow::Result;
use serde::{Deserialize, Serialize};

use crate::platform;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default = "default_true")]
    pub daemon: bool,
    #[serde(default)]
    pub mirror: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spotify_data_path: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spotify_exec_path: Option<PathBuf>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub spotify_config_path: Option<PathBuf>,
}

fn default_true() -> bool {
    true
}

impl Default for Config {
    fn default() -> Self {
        Self {
            daemon: true,
            mirror: false,
            spotify_data_path: None,
            spotify_exec_path: None,
            spotify_config_path: None,
        }
    }
}

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        if path.exists() {
            let raw = fs::read_to_string(path)?;
            yaml_serde::from_str(&raw).map_err(Into::into)
        } else {
            Ok(Self::default())
        }
    }

    pub fn save(path: &Path, cfg: &Self) -> Result<()> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, yaml_serde::to_string(cfg)?)?;
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct AppContext {
    pub config_file: PathBuf,
    pub config_root: PathBuf,
    pub daemon: bool,
    pub mirror: bool,
    pub spotify_data_path: PathBuf,
    pub spotify_exec_path: PathBuf,
    pub spotify_config_path: PathBuf,
}

impl AppContext {
    pub fn from_config(config_root: PathBuf, cfg: Config) -> Self {
        let config_file = config_root.join("config.yaml");
        let spotify_data_path = cfg
            .spotify_data_path
            .unwrap_or_else(platform::default_spotify_data_path);
        let spotify_exec_path = cfg
            .spotify_exec_path
            .unwrap_or_else(|| platform::default_spotify_exec_path(&spotify_data_path));
        let spotify_config_path = cfg
            .spotify_config_path
            .unwrap_or_else(platform::default_spotify_config_path);
        Self {
            config_file,
            config_root,
            daemon: cfg.daemon,
            mirror: cfg.mirror,
            spotify_data_path,
            spotify_exec_path,
            spotify_config_path,
        }
    }

    pub fn spotify_apps_path(&self) -> PathBuf {
        self.spotify_data_path.join("Apps")
    }
}
