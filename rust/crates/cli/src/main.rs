use std::io::{self, Write};

use anyhow::Result;
use clap::{CommandFactory, Parser, Subcommand};
use clap_complete::CompleteEnv;
use i18n_embed_fl as _;
use spicetify::commands::{Command, ConfigAction, DaemonAction, PkgAction, UpdatesAction};
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
    #[command(about = "Show the paths spicetify uses")]
    Path,
    #[command(about = "Print diagnostics for bug reports")]
    Support,
    #[command(about = "Restart the Spotify client")]
    Restart,
    #[command(about = "Update CLI/TUI to the latest version")]
    SelfUpdate,
    #[command(name = "spotify-updates", about = "Control Spotify's self-updater")]
    SpotifyUpdates {
        #[command(subcommand)]
        action: CliUpdatesAction,
    },
}

#[derive(Debug, Clone, Copy, Subcommand)]
enum CliUpdatesAction {
    #[command(about = "Block Spotify from self-updating")]
    Block,
    #[command(about = "Allow Spotify to self-update")]
    Unblock,
    #[command(about = "Show whether updates are blocked")]
    Status,
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
    #[command(about = "List installed modules")]
    List,
    #[command(about = "Install a module by identifier (or from an explicit URL)")]
    Install {
        id: String,
        #[arg(help = "Bypass the vault and install this artifact directly, unverified")]
        url: Option<String>,
    },
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
            CliCommand::Path => Command::Path,
            CliCommand::Support => Command::Support,
            CliCommand::Restart => Command::Restart,
            CliCommand::SelfUpdate => Command::SelfUpdate,
            CliCommand::SpotifyUpdates { action } => Command::SpotifyUpdates(match action {
                CliUpdatesAction::Block => UpdatesAction::Block,
                CliUpdatesAction::Unblock => UpdatesAction::Unblock,
                CliUpdatesAction::Status => UpdatesAction::Status,
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
            CliPkgAction::List => PkgAction::List,
            CliPkgAction::Install { id, url } => PkgAction::Install { id, url },
            CliPkgAction::Delete { id } => PkgAction::Delete { id },
            CliPkgAction::Enable { id } => PkgAction::Enable { id },
        }
    }
}

fn main() {
    // Intercepts a `COMPLETE=<shell>` invocation to generate shell completions
    // and exits, otherwise falls through to normal startup.
    // Must run before locale::localize() to avoid unnecessary overhead on
    // every tab-completion keystroke.
    CompleteEnv::with_factory(SpicetifyCli::command).complete();
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
                eprint!(
                    "This will reset Spicetify configuration and delete every installed module, \
                     theme and store file. Continue? [y/N] "
                );
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
