use std::path::PathBuf;

use anyhow::Result;
use clap::Parser;
use spicetify::{
    commands::{Command, DaemonAction, PkgAction, UpdateMode, dispatch}, config::{AppContext, Config}, i18n
};

#[derive(Debug, Parser)]
#[command(name = "spicetify", about = "Make Spotify your own")]
struct SpicetifyCli {
    #[arg(long)]
    config: Option<String>,
    #[arg(short = 'm', long, default_value_t = false)]
    mirror: bool,
    #[arg(long)]
    spotify_data_path: Option<String>,
    #[arg(long)]
    spotify_exec_path: Option<String>,
    #[arg(long)]
    spotify_config_path: Option<String>,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Debug, clap::Subcommand)]
enum Commands {
    Apply,
    Config,
    Daemon {
        #[command(subcommand)]
        action: Option<DaemonArgs>,
    },
    Dev,
    Fix,
    Init,
    Pkg {
        #[command(subcommand)]
        action: PkgArgs,
    },
    Protocol {
        uri: String,
    },
    SelfUpdate,
    Sync,
    Update {
        #[command(subcommand)]
        mode: UpdateArgs,
    },
}

#[derive(Debug, clap::Subcommand)]
enum DaemonArgs {
    Start,
    Enable,
    Disable,
}

#[derive(Debug, clap::Subcommand)]
enum PkgArgs {
    Install { id: String, url: String },
    Delete { id: String },
    Enable { id: String },
}

#[derive(Debug, Clone, Copy, clap::Subcommand)]
enum UpdateArgs {
    On,
    Off,
}

fn main() {
    if let Err(err) = run() {
        eprintln!("\x1b[31;1m{}\x1b[0m {err}", i18n::lookup("fatal_prefix"));
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let cli = SpicetifyCli::parse();
    let ctx = build_context(
        cli.config.as_deref(),
        cli.mirror,
        cli.spotify_data_path.as_deref(),
        cli.spotify_exec_path.as_deref(),
        cli.spotify_config_path.as_deref(),
    )?;

    match cli.command {
        Some(cmd) => dispatch(map_command(cmd), &ctx),
        None => tui::run(&ctx),
    }
}

fn map_command(cmd: Commands) -> Command {
    match cmd {
        Commands::Apply => Command::Apply,
        Commands::Config => Command::Config,
        Commands::Daemon { action } => {
            let action = match action {
                Some(DaemonArgs::Start) => DaemonAction::Start,
                Some(DaemonArgs::Enable) => DaemonAction::Enable,
                Some(DaemonArgs::Disable) => DaemonAction::Disable,
                None => DaemonAction::Auto,
            };
            Command::Daemon(action)
        }
        Commands::Dev => Command::Dev,
        Commands::Fix => Command::Fix,
        Commands::Init => Command::Init,
        Commands::Pkg { action } => {
            let action = match action {
                PkgArgs::Install { id, url } => PkgAction::Install { id, url },
                PkgArgs::Delete { id } => PkgAction::Delete { id },
                PkgArgs::Enable { id } => PkgAction::Enable { id },
            };
            Command::Pkg(action)
        }
        Commands::Protocol { uri } => Command::Protocol(uri),
        Commands::SelfUpdate => Command::SelfUpdate,
        Commands::Sync => Command::Sync,
        Commands::Update { mode } => {
            let mode = match mode {
                UpdateArgs::On => UpdateMode::On,
                UpdateArgs::Off => UpdateMode::Off,
            };
            Command::Update(mode)
        }
    }
}

fn build_context(
    config: Option<&str>,
    mirror: bool,
    spotify_data_path: Option<&str>,
    spotify_exec_path: Option<&str>,
    spotify_config_path: Option<&str>,
) -> Result<AppContext> {
    let config_root = config
        .map(PathBuf::from)
        .unwrap_or_else(spicetify::platform::default_spicetify_config_root);

    let config_file = config_root.join("config.yaml");
    let mut cfg = Config::load(&config_file)?;

    cfg.mirror = cfg.mirror || mirror;
    if let Some(v) = spotify_data_path {
        cfg.spotify_data_path = Some(PathBuf::from(v));
    }
    if let Some(v) = spotify_exec_path {
        cfg.spotify_exec_path = Some(PathBuf::from(v));
    }
    if let Some(v) = spotify_config_path {
        cfg.spotify_config_path = Some(PathBuf::from(v));
    }

    Ok(AppContext::from_config(config_root, cfg))
}
