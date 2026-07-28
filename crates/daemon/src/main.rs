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

    std::panic::set_hook(Box::new(|info| {
        tracing::error!("panic: {info}");
    }));

    let config_root = spicetify::platform::default_spicetify_config_dir();
    let log_path = config_root.join("daemon.log");
    if let Err(e) = spicetify::logging::init_for_file(&log_path) {
        eprintln!("failed to initialize daemon logging: {e}");
    }

    if let Err(err) = server::run() {
        tracing::error!("daemon fatal error: {err:#}");
        std::process::exit(1);
    }
}
