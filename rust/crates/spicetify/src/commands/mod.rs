use crate::context::AppContext;
use crate::error::Result;

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
pub enum SyncTarget {
    Auto,
    Url(String),
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
    Sync(SyncTarget),
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

pub fn dispatch(cmd: &Command, ctx: &AppContext) -> Result<()> {
    match cmd {
        Command::Apply => apply::run(ctx),
        Command::Config(action) => match action {
            ConfigAction::Show => config::run(ctx),
            ConfigAction::OpenFolder => config::open_folder(ctx),
        },
        Command::Daemon(action) => match action {
            DaemonAction::Start => daemon::start(),
            DaemonAction::Stop => daemon::stop(),
            DaemonAction::Install => daemon::install(),
            DaemonAction::Uninstall => daemon::uninstall(),
            DaemonAction::Status => daemon::status(),
        },
        Command::Dev => dev::run(ctx),
        Command::Restore => restore::run(ctx),
        Command::Init => init::run(ctx),
        Command::Pkg(action) => match action {
            PkgAction::Install { id, url } => {
                crate::module::install_from_url(&ctx.config_root, id, url)
            }
            PkgAction::Delete { id } => crate::module::delete_module(&ctx.config_root, id),
            PkgAction::Enable { id } => crate::module::enable_module(&ctx.config_root, id),
        },
        Command::Protocol(uri) => protocol::run(ctx, uri),
        Command::Sync(target) => sync::run(ctx, target),
        Command::SelfUpdate => self_update::run(),
    }
}
