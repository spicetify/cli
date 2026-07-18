use crate::context::AppContext;
use crate::error::Result;
use crate::fl;

pub mod apply;
mod config;
mod daemon;
mod dev;
mod init;
pub mod protocol;
mod restore;
mod self_update;
mod sync;

#[derive(Debug, Clone, Copy)]
pub enum ConfigAction {
    Show,
    OpenFolder,
}

#[derive(Debug, Clone)]
pub enum Command {
    Apply,
    Config(ConfigAction),
    Daemon(DaemonAction),
    Dev,
    Restore,
    Init,
    Pkg(PkgAction),
    Protocol(String),
    SelfUpdate,
    Sync,
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

impl Command {
    #[must_use]
    pub fn success_message(&self) -> Option<String> {
        match self {
            Self::Apply => Some(fl!("applied-patches")),
            Self::Restore => Some(fl!("restored-stock")),
            Self::Dev => Some(fl!("app-developer-enabled")),
            Self::Daemon(DaemonAction::Start) => Some(fl!("daemon-starting")),
            Self::Daemon(DaemonAction::Stop) => Some(fl!("daemon-stopping-resp")),
            Self::Daemon(DaemonAction::Install) => Some(fl!("daemon-enabling")),
            Self::Daemon(DaemonAction::Uninstall) => Some(fl!("daemon-disabling")),
            Self::Init => Some(fl!("initialised-spicetify")),
            Self::Pkg(PkgAction::Install { .. }) => Some(fl!("module-added")),
            Self::Pkg(PkgAction::Delete { .. }) => Some(fl!("module-deleted")),
            Self::Pkg(PkgAction::Enable { .. }) => Some(fl!("module-enabled")),
            Self::Sync => Some(fl!("hooks-updated")),
            _ => None,
        }
    }
}

pub fn dispatch(cmd: &Command, ctx: &AppContext) -> Result<()> {
    match cmd {
        Command::Apply => apply::execute(ctx),
        Command::Config(action) => match action {
            ConfigAction::Show => {
                config::run(ctx);
                Ok(())
            }
            ConfigAction::OpenFolder => config::open_folder(ctx),
        },
        Command::Daemon(action) => match action {
            DaemonAction::Start => {
                daemon::start();
                Ok(())
            }
            DaemonAction::Stop => {
                daemon::stop();
                Ok(())
            }
            DaemonAction::Install => daemon::install(),
            DaemonAction::Uninstall => daemon::uninstall(),
            DaemonAction::Status => {
                daemon::status();
                Ok(())
            }
        },
        Command::Dev => dev::execute(ctx),
        Command::Restore => restore::execute(ctx),
        Command::Init => init::run(ctx),
        Command::Pkg(action) => match action {
            PkgAction::Install { id, url } => {
                crate::module::install_from_url(&ctx.config_root, id, url)
            }
            PkgAction::Delete { id } => crate::module::delete_module(&ctx.config_root, id),
            PkgAction::Enable { id } => crate::module::enable_module(&ctx.config_root, id),
        },
        Command::Protocol(uri) => protocol::run(ctx, uri),
        Command::Sync => sync::run(ctx),
        Command::SelfUpdate => self_update::run(),
    }
}
