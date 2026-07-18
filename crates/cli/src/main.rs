use anyhow::Result;
use clap::{Parser, Subcommand};
use i18n_embed_fl as _;
use spicetify::commands::{Command, ConfigAction, DaemonAction, PkgAction};
use spicetify::{fl, logging};

#[derive(Debug, Parser)]
#[command(name = "spicetify", about = "Make Spotify your own")]
struct SpicetifyCli {
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
    Config {
        #[command(subcommand)]
        action: Option<CliConfigAction>,
    },
    #[command(subcommand)]
    Daemon(CliDaemonAction),
    Dev,
    Restore,
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
enum CliConfigAction {
    Open,
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
            CliCommand::Config { action } => {
                let action = match action {
                    Some(CliConfigAction::Open) => ConfigAction::OpenFolder,
                    None => ConfigAction::Show,
                };
                Command::Config(action)
            }
            CliCommand::Daemon(a) => Command::Daemon(a.into()),
            CliCommand::Dev => Command::Dev,
            CliCommand::Restore => Command::Restore,
            CliCommand::Init => Command::Init,
            CliCommand::Pkg { action } => Command::Pkg(action.into()),
            CliCommand::Protocol { uri } => Command::Protocol(uri),
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
    let _ = color_eyre::install();
    if let Err(err) = run() {
        eprintln!("{} {err:#}", fl!("fatal-prefix"));
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let cli = SpicetifyCli::parse();
    let ctx = spicetify::context::build_context(
        cli.mirror,
        cli.spotify_data_path.as_deref(),
        cli.spotify_exec_path.as_deref(),
        cli.offline_bnk_dir.as_deref(),
    )?;

    spicetify::update::startup_cleanup();

    match cli.command {
        Some(cmd) => {
            logging::init_for_cli()?;
            let cmd = Command::from(cmd);
            spicetify::commands::dispatch(&cmd, &ctx)
        }
        None => tui::run(&ctx),
    }
}
