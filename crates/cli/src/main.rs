use std::io::{self, Write};

use anyhow::Result;
use clap::{Parser, Subcommand};
use i18n_embed_fl as _;
use spicetify::commands::{Command, ConfigAction, DaemonAction, PkgAction, SyncTarget};
use spicetify::{fl, logging};

#[derive(Debug, Parser)]
#[command(name = "spicetify", version, disable_help_subcommand = true)]
struct SpicetifyCli {
    #[arg(
        short = 'm',
        long,
        global = true,
        num_args = 0..=1,
        default_missing_value = "true"
    )]
    mirror: Option<bool>,
    #[arg(long, global = true)]
    spotify_data_dir: Option<String>,
    #[arg(long, global = true)]
    spotify_exec: Option<String>,
    #[arg(long, global = true)]
    offline_bnk_dir: Option<String>,

    #[command(subcommand)]
    command: Option<CliCommand>,
}

#[derive(Debug, Clone, Subcommand)]
enum CliCommand {
    #[command(about = "Apply Spicetify patches to Spotify")]
    Apply,
    #[command(about = "Manage Spicetify configuration")]
    Config {
        #[command(subcommand)]
        action: Option<CliConfigAction>,
    },
    #[command(about = "Manage the Spicetify daemon service")]
    #[command(subcommand)]
    Daemon(CliDaemonAction),
    #[command(about = "Enable developer mode (Inspect Element)")]
    Dev,
    #[command(about = "Restore stock Spotify")]
    Restore,
    #[command(about = "Initialize Spicetify (requires confirmation)")]
    Init {
        #[arg(long, help = "Skip the confirmation prompt")]
        yes: bool,
    },
    #[command(about = "Manage Spicetify modules")]
    Pkg {
        #[command(subcommand)]
        action: CliPkgAction,
    },
    #[command(name = "protocol", about = "Handle spicetify:// protocol URIs")]
    Protocol { uri: String },
    #[command(about = "Update CLI/TUI to the latest version")]
    SelfUpdate,
    #[command(about = "Update hooks to a specific version")]
    Sync {
        #[arg(long)]
        url: Option<String>,
    },
}

#[derive(Debug, Clone, Copy, Subcommand)]
enum CliConfigAction {
    #[command(about = "Open the configuration folder")]
    Open,
}

#[derive(Debug, Clone, Copy, Subcommand)]
enum CliDaemonAction {
    #[command(about = "Start the daemon")]
    Start,
    #[command(about = "Stop the daemon")]
    Stop,
    #[command(about = "Install the daemon service")]
    Install,
    #[command(about = "Uninstall the daemon service")]
    Uninstall,
    #[command(about = "Check daemon status")]
    Status,
}

#[derive(Debug, Clone, Subcommand)]
enum CliPkgAction {
    #[command(about = "Install a package")]
    Install { id: String, url: String },
    #[command(about = "Delete a package")]
    Delete { id: String },
    #[command(about = "Enable a package")]
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
            CliCommand::Init { .. } => Command::Init,
            CliCommand::Pkg { action } => Command::Pkg(action.into()),
            CliCommand::Protocol { uri } => Command::Protocol(uri),
            CliCommand::SelfUpdate => Command::SelfUpdate,
            CliCommand::Sync { url } => Command::Sync(match url {
                Some(u) => SyncTarget::Url(u),
                None => SyncTarget::Auto,
            }),
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
        eprintln!("{} {err:#}", fl!("fatal-prefix"));
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let cli = SpicetifyCli::parse();

    spicetify::update::startup_cleanup();

    match cli.command {
        Some(cmd) => {
            logging::init_for_cli()?;

            if let CliCommand::Init { yes: false } = &cmd {
                eprint!("This will reset all Spicetify configuration. Continue? [y/N] ");
                io::stderr().flush()?;
                let mut input = String::new();
                if io::stdin().read_line(&mut input)? == 0 {
                    return Ok(());
                }
                if !input.trim().eq_ignore_ascii_case("y") {
                    return Ok(());
                }
            }

            let ctx = if matches!(cmd, CliCommand::Init { .. }) {
                spicetify::context::build_fresh_context()?
            } else {
                spicetify::context::build_context(
                    cli.mirror,
                    cli.spotify_data_dir.as_deref(),
                    cli.spotify_exec.as_deref(),
                    cli.offline_bnk_dir.as_deref(),
                )?
            };
            let cmd = Command::from(cmd);
            spicetify::commands::dispatch(&cmd, &ctx)
        }
        None => tui::run(
            cli.mirror,
            cli.spotify_data_dir.as_deref(),
            cli.spotify_exec.as_deref(),
            cli.offline_bnk_dir.as_deref(),
        ),
    }
}
