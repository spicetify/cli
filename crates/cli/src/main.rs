use std::path::PathBuf;

use anyhow::Result;
use clap::{Parser, Subcommand};
use i18n_embed_fl as _;
use spicetify::commands::{Command, DaemonAction, PkgAction};
use spicetify::context::AppContext;
use spicetify::{fl, logging};

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
    offline_bnk_dir: Option<String>,

    #[command(subcommand)]
    command: Option<CliCommand>,
}

#[derive(Debug, Clone, Subcommand)]
enum CliCommand {
    Apply,
    Config,
    #[command(subcommand)]
    Daemon(CliDaemonAction),
    Dev,
    Fix,
    Init,
    Pkg {
        #[command(subcommand)]
        action: CliPkgAction,
    },
    #[command(name = "protocol")]
    Protocol {
        uri: String,
    },
    SelfUpdate,
    Sync,
}

#[derive(Debug, Clone, Copy, Subcommand)]
enum CliDaemonAction {
    Start,
    Stop,
    Install,
    Uninstall,
    Status,
}

#[derive(Debug, Clone, Subcommand)]
enum CliPkgAction {
    Install { id: String, url: String },
    Delete { id: String },
    Enable { id: String },
}

impl From<CliCommand> for Command {
    fn from(c: CliCommand) -> Self {
        match c {
            CliCommand::Apply => Command::Apply,
            CliCommand::Config => Command::Config,
            CliCommand::Daemon(a) => Command::Daemon(a.into()),
            CliCommand::Dev => Command::Dev,
            CliCommand::Fix => Command::Fix,
            CliCommand::Init => Command::Init,
            CliCommand::Pkg { action } => Command::Pkg { action: action.into() },
            CliCommand::Protocol { uri } => Command::Protocol { uri },
            CliCommand::SelfUpdate => Command::SelfUpdate,
            CliCommand::Sync => Command::Sync,
        }
    }
}

impl From<CliDaemonAction> for DaemonAction {
    fn from(a: CliDaemonAction) -> Self {
        match a {
            CliDaemonAction::Start => DaemonAction::Start,
            CliDaemonAction::Stop => DaemonAction::Stop,
            CliDaemonAction::Install => DaemonAction::Install,
            CliDaemonAction::Uninstall => DaemonAction::Uninstall,
            CliDaemonAction::Status => DaemonAction::Status,
        }
    }
}

impl From<CliPkgAction> for PkgAction {
    fn from(a: CliPkgAction) -> Self {
        match a {
            CliPkgAction::Install { id, url } => PkgAction::Install { id, url },
            CliPkgAction::Delete { id } => PkgAction::Delete { id },
            CliPkgAction::Enable { id } => PkgAction::Enable { id },
        }
    }
}

fn main() {
    spicetify::locale::localize();
    if let Err(err) = run() {
        eprintln!("\x1b[31;1m{}\x1b[0m {err}", fl!("fatal-prefix"));
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
        cli.offline_bnk_dir.as_deref(),
    )?;

    match cli.command {
        Some(cmd) => {
            logging::init_for_cli()?;
            let cmd = Command::from(cmd);
            spicetify::commands::dispatch(&cmd, &ctx)
        }
        None => tui::run(&ctx),
    }
}

fn build_context(
    config: Option<&str>,
    mirror: bool,
    spotify_data_path: Option<&str>,
    spotify_exec_path: Option<&str>,
    offline_bnk_dir: Option<&str>,
) -> Result<AppContext> {
    let config_root =
        config.map_or_else(spicetify::platform::default_spicetify_config_root, PathBuf::from);

    let config_name =
        std::env::var("SPICETIFY_CONFIG_FILE").unwrap_or_else(|_| "config.toml".to_string());
    let config_file = config_root.join(&config_name);
    let mut cfg = spicetify::context::Config::load(&config_file)?;

    cfg.mirror = cfg.mirror || mirror;
    if let Some(v) = spotify_data_path {
        cfg.spotify_data_path = Some(PathBuf::from(v));
    }
    if let Some(v) = spotify_exec_path {
        cfg.spotify_exec_path = Some(PathBuf::from(v));
    }
    if let Some(v) = offline_bnk_dir {
        cfg.offline_bnk_dir = Some(PathBuf::from(v));
    }

    AppContext::from_config(config_root, &cfg)
}
