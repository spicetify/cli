mod cli;
mod commands;
mod config;
mod daemon;
mod logging;
mod module;
mod platform;
mod process;
mod tui;
mod util;

use std::path::PathBuf;

use anyhow::Result;
use clap::Parser;

use crate::{
    cli::{
        DaemonAction, PkgAction, SpicetifyCli, SpicetifyCommand, SpotifyCli, SpotifyCommand, UpdateMode
    }, config::{AppContext, Config}
};

fn main() {
    if let Err(err) = run() {
        eprintln!("\x1b[31;1mFATAL\x1b[0m {err}");
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let spotify_mode = detect_spotify_mode();

    if spotify_mode {
        return run_spotify();
    }

    let cli = SpicetifyCli::parse();
    let ctx = build_context(&cli.global)?;

    match cli.command {
        Some(cmd) => run_spicetify_command(cmd, &ctx),
        None => tui::run(&ctx),
    }
}

fn run_spotify() -> Result<()> {
    let cli = SpotifyCli::parse();
    let ctx = build_context(&cli.global)?;

    match cli.command {
        SpotifyCommand::Run { args } => commands::run::run(&ctx, &args),
        SpotifyCommand::Update { mode } => {
            if matches!(mode, UpdateMode::Off) {
                process::stop(&ctx)?;
            }
            commands::update::run(&ctx, matches!(mode, UpdateMode::On))?;
            logging::info("Patched the executable successfully");
            Ok(())
        }
    }
}

fn run_spicetify_command(cmd: SpicetifyCommand, ctx: &AppContext) -> Result<()> {
    match cmd {
        SpicetifyCommand::Apply => {
            commands::apply::run(ctx)?;
            logging::info("Patched Spotify");
            process::restart_if_running(ctx)
        }
        SpicetifyCommand::Config => commands::config::run(ctx),
        SpicetifyCommand::Daemon { action } => match action {
            Some(DaemonAction::Start) => {
                logging::info("Starting daemon");
                commands::daemon::start(ctx)
            }
            Some(DaemonAction::Enable) => {
                logging::info("Enabling daemon");
                commands::daemon::enable(ctx)
            }
            Some(DaemonAction::Disable) => {
                logging::info("Disabling daemon");
                commands::daemon::disable(ctx)
            }
            None => {
                logging::info("Starting daemon");
                commands::daemon::auto(ctx)
            }
        },
        SpicetifyCommand::Dev => {
            commands::dev::run(ctx)?;
            logging::info("Mode app-developer enabled");
            process::restart_if_running(ctx)
        }
        SpicetifyCommand::Fix => {
            commands::fix::run(ctx)?;
            logging::info("Restored Spotify to stock state");
            process::restart_if_running(ctx)
        }
        SpicetifyCommand::Init => {
            commands::init::run(ctx)?;
            logging::info("Initialized spicetify");
            Ok(())
        }
        SpicetifyCommand::Pkg { action } => match action {
            PkgAction::Install { id, url } => {
                commands::pkg::install(ctx, &id, &url)?;
                logging::info("Module added");
                Ok(())
            }
            PkgAction::Delete { id } => {
                commands::pkg::delete(ctx, &id)?;
                logging::info("Module deleted");
                Ok(())
            }
            PkgAction::Enable { id } => {
                commands::pkg::enable(ctx, &id)?;
                logging::info("Module enabled");
                Ok(())
            }
        },
        SpicetifyCommand::Protocol { uri } => commands::protocol::run(ctx, &uri),
        SpicetifyCommand::Sync => {
            commands::sync::run(ctx)?;
            logging::info("Hooks updated successfully");
            Ok(())
        }
        SpicetifyCommand::Update { mode } => {
            if matches!(mode, UpdateMode::Off) {
                process::stop(ctx)?;
            }
            commands::update::run(ctx, matches!(mode, UpdateMode::On))?;
            logging::info("Patched the executable successfully");
            Ok(())
        }
    }
}

fn build_context(args: &cli::GlobalArgs) -> Result<AppContext> {
    let config_root = args
        .config
        .as_ref()
        .map(PathBuf::from)
        .unwrap_or_else(platform::default_spicetify_config_root);

    let config_file = config_root.join("config.yaml");
    let mut cfg = Config::load(&config_file)?;

    cfg.mirror = cfg.mirror || args.mirror;
    if let Some(ref v) = args.spotify_data_path {
        cfg.spotify_data_path = Some(PathBuf::from(v));
    }
    if let Some(ref v) = args.spotify_exec_path {
        cfg.spotify_exec_path = Some(PathBuf::from(v));
    }
    if let Some(ref v) = args.spotify_config_path {
        cfg.spotify_config_path = Some(PathBuf::from(v));
    }

    Ok(AppContext::from_config(config_root, cfg))
}

fn detect_spotify_mode() -> bool {
    let exe = std::env::args_os()
        .next()
        .and_then(|s| {
            std::path::PathBuf::from(s)
                .file_name()
                .map(|s| s.to_os_string())
        })
        .and_then(|s| s.to_str().map(|s| s.to_lowercase()))
        .unwrap_or_else(|| "spicetify".into());
    exe.starts_with("spotify")
}
