#![windows_subsystem = "windows"]

use i18n_embed_fl as _;

pub mod error;
pub mod health;
pub mod proxy;
pub mod routes;
pub mod server;
pub mod watcher;

fn main() {
    spicetify::locale::localize();
    if let Err(err) = server::run() {
        log_err(&err);
        std::process::exit(1);
    }
}

fn log_err(err: &anyhow::Error) {
    use std::path::PathBuf;
    if let Ok(root) = std::env::var("SPICETIFY_CONFIG_ROOT").or_else(|_| {
        let p = spicetify::platform::default_spicetify_config_root();
        Ok::<String, std::env::VarError>(p.display().to_string())
    }) {
        let log_path = PathBuf::from(root).join("daemon.log");
        if let Err(e) = std::fs::write(&log_path, format!("daemon error: {err}\n")) {
            tracing::warn!(error = %e, "failed to write daemon error log");
        }
    }
}
