use clap::{Args, Parser, Subcommand};

#[derive(Debug, Clone, Args)]
pub struct GlobalArgs {
    #[arg(long)]
    pub config: Option<String>,
    #[arg(short = 'm', long, default_value_t = false)]
    pub mirror: bool,
    #[arg(long)]
    pub spotify_data_path: Option<String>,
    #[arg(long)]
    pub spotify_exec_path: Option<String>,
    #[arg(long)]
    pub spotify_config_path: Option<String>,
}

/// `spicetify` CLI — customization manager.
#[derive(Debug, Parser)]
#[command(name = "spicetify", about = "Make Spotify your own")]
pub struct SpicetifyCli {
    #[command(flatten)]
    pub global: GlobalArgs,
    #[command(subcommand)]
    pub command: Option<SpicetifyCommand>,
}

/// `spotify` CLI — transparent wrapper when invoked as spotify.exe.
#[derive(Debug, Parser)]
#[command(name = "spotify", about = "Spotify command wrapper")]
pub struct SpotifyCli {
    #[command(flatten)]
    pub global: GlobalArgs,
    #[command(subcommand)]
    pub command: SpotifyCommand,
}

#[derive(Debug, Subcommand)]
pub enum SpicetifyCommand {
    Apply,
    Config,
    Daemon {
        #[command(subcommand)]
        action: Option<DaemonAction>,
    },
    Dev,
    Fix,
    Init,
    Pkg {
        #[command(subcommand)]
        action: PkgAction,
    },
    Protocol {
        uri: String,
    },
    Sync,
    Update {
        #[command(subcommand)]
        mode: UpdateMode,
    },
}

#[derive(Debug, Subcommand)]
pub enum SpotifyCommand {
    Run {
        #[arg(trailing_var_arg = true)]
        args: Vec<String>,
    },
    Update {
        #[command(subcommand)]
        mode: UpdateMode,
    },
}

#[derive(Debug, Clone, Copy, Subcommand)]
pub enum UpdateMode {
    On,
    Off,
}

#[derive(Debug, Subcommand)]
pub enum DaemonAction {
    Start,
    Enable,
    Disable,
}

#[derive(Debug, Subcommand)]
pub enum PkgAction {
    Install { id: String, url: String },
    Delete { id: String },
    Enable { id: String },
}
