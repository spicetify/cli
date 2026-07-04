use crate::context::AppContext;
use crate::error::Result;
use crate::fl;

pub mod apply;
mod block_spotify_updates;
mod config;
mod daemon;
mod dev;
mod fix;
mod init;
mod pkg;
pub mod protocol;
mod self_update;
mod sync;

#[derive(Debug, Clone)]
pub enum Command {
    Apply,
    Config,
    Daemon(DaemonAction),
    Dev,
    Fix,
    Init,
    Pkg { action: PkgAction },
    Protocol { uri: String },
    SelfUpdate,
    Sync,
    BlockSpotifyUpdates { mode: SpotifyAutoUpdate },
}

#[derive(Debug, Clone, Copy)]
pub enum DaemonAction {
    Start,
    Stop,
    Install,
    Uninstall,
    Status,
}

#[derive(Debug, Clone)]
pub enum PkgAction {
    Install { id: String, url: String },
    Delete { id: String },
    Enable { id: String },
}

#[derive(Debug, Clone, Copy)]
pub enum SpotifyAutoUpdate {
    Block,
    Unblock,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Phase {
    StopSpotify,
    StartSpotify,
    UninstallDaemon,
    InstallDaemon,
    ShutdownDaemon,
}

impl Phase {
    fn execute(self, ctx: &AppContext) -> Result<()> {
        match self {
            Self::StopSpotify => crate::lifecycle::stop(ctx),
            Self::StartSpotify => crate::lifecycle::start(ctx),
            Self::UninstallDaemon => {
                if let Err(e) = daemon::uninstall(ctx) {
                    tracing::warn!(error = %e, "failed to uninstall daemon auto-start");
                }
                Ok(())
            }
            Self::InstallDaemon => {
                if let Err(e) = daemon::install(ctx) {
                    tracing::warn!(error = %e, "failed to install daemon auto-start");
                }
                Ok(())
            }
            Self::ShutdownDaemon => {
                if crate::daemon::is_daemon_running() {
                    crate::daemon::shutdown_daemon();
                }
                Ok(())
            }
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct Lifecycle {
    pre: Vec<Phase>,
    post: Vec<Phase>,
}

impl Lifecycle {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    pub fn pre(mut self, phase: Phase) -> Self {
        self.pre.push(phase);
        self
    }

    #[must_use]
    pub fn post(mut self, phase: Phase) -> Self {
        self.post.push(phase);
        self
    }

    fn run_pre(&self, ctx: &AppContext) -> Result<()> {
        for phase in &self.pre {
            phase.execute(ctx)?;
        }
        Ok(())
    }

    fn run_post(&self, ctx: &AppContext) -> Result<()> {
        for phase in &self.post {
            phase.execute(ctx)?;
        }
        Ok(())
    }
}

impl Command {
    #[must_use]
    pub fn lifecycle(&self) -> Lifecycle {
        match self {
            Self::Apply => Lifecycle::new()
                .pre(Phase::StopSpotify)
                .post(Phase::InstallDaemon)
                .post(Phase::StartSpotify),

            Self::Fix => Lifecycle::new()
                .pre(Phase::UninstallDaemon)
                .pre(Phase::ShutdownDaemon)
                .pre(Phase::StopSpotify)
                .post(Phase::StartSpotify),
            Self::Dev => Lifecycle::new().pre(Phase::StopSpotify).post(Phase::StartSpotify),
            Self::BlockSpotifyUpdates { mode: SpotifyAutoUpdate::Unblock } => {
                Lifecycle::new().pre(Phase::StopSpotify)
            }
            _ => Lifecycle::new(),
        }
    }

    #[must_use]
    pub fn success_message(&self) -> Option<String> {
        match self {
            Self::Apply => Some(fl!("applied-patches")),
            Self::Fix => Some(fl!("restored-stock")),
            Self::Dev => Some(fl!("app-developer-enabled")),
            Self::BlockSpotifyUpdates { .. } => Some(fl!("exec-patched")),
            Self::Daemon(DaemonAction::Start) => Some(fl!("daemon-starting")),
            Self::Daemon(DaemonAction::Stop) => Some(fl!("daemon-stopping-resp")),
            Self::Daemon(DaemonAction::Install) => Some(fl!("daemon-enabling")),
            Self::Daemon(DaemonAction::Uninstall) => Some(fl!("daemon-disabling")),
            Self::Init => Some(fl!("initialised-spicetify")),
            Self::Pkg { action: PkgAction::Install { .. } } => Some(fl!("module-added")),
            Self::Pkg { action: PkgAction::Delete { .. } } => Some(fl!("module-deleted")),
            Self::Pkg { action: PkgAction::Enable { .. } } => Some(fl!("module-enabled")),
            Self::Sync => Some(fl!("hooks-updated")),
            _ => None,
        }
    }
}

pub fn dispatch(cmd: &Command, ctx: &AppContext) -> Result<()> {
    let lc = cmd.lifecycle();
    lc.run_pre(ctx)?;

    let result = dispatch_inner(cmd, ctx);

    if result.is_ok() {
        lc.run_post(ctx)?;
        if let Some(msg) = cmd.success_message() {
            tracing::info!("{msg}");
        }
    }

    result
}

pub fn dispatch_inner(cmd: &Command, ctx: &AppContext) -> Result<()> {
    match cmd {
        Command::Apply => apply::run(ctx),
        Command::Config => {
            config::run(ctx);
            Ok(())
        }
        Command::Daemon(action) => match action {
            DaemonAction::Start => {
                if let Err(e) = crate::daemon::process::spawn(ctx) {
                    tracing::warn!(error = %e, "{}", fl!("failed-spawn-daemon"));
                }
                Ok(())
            }
            DaemonAction::Stop => {
                crate::daemon::shutdown_daemon();
                Ok(())
            }
            DaemonAction::Install => daemon::install(ctx),
            DaemonAction::Uninstall => daemon::uninstall(ctx),
            DaemonAction::Status => {
                daemon::status(ctx);
                Ok(())
            }
        },
        Command::Dev => dev::run(ctx),
        Command::Fix => fix::run(ctx),
        Command::Init => init::run(ctx),
        Command::Pkg { action } => match action {
            PkgAction::Install { id, url } => pkg::install(ctx, id, url),
            PkgAction::Delete { id } => pkg::delete(ctx, id),
            PkgAction::Enable { id } => pkg::enable(ctx, id),
        },
        Command::Protocol { uri } => protocol::run(ctx, uri),
        Command::Sync => sync::run(ctx),
        Command::SelfUpdate => self_update::run(),
        Command::BlockSpotifyUpdates { mode } => {
            block_spotify_updates::run(ctx, matches!(mode, SpotifyAutoUpdate::Block))
        }
    }
}
