use crate::context::AppContext;
use crate::error::Result;

pub mod apply;
mod config;
mod daemon;
mod dev;
mod diagnostics;
mod init;
mod pkg;
pub mod protocol;
mod restore;
mod self_update;
mod sync;
pub mod updates;

#[derive(Debug, Clone, Copy)]
pub enum ConfigAction {
    Show,
    OpenFolder,
}

#[derive(Debug, Clone)]
pub enum SyncTarget {
    Auto,
    Url(String),
    /// A locally built payload directory, for developing the client stack
    /// before it is published. Never reachable from release or self-update
    /// flows, which resolve through the manifest.
    Local(std::path::PathBuf),
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
    SpotifyUpdates(UpdatesAction),
    Path,
    Support,
    Restart,
}

#[derive(Debug, Clone, Copy)]
pub enum UpdatesAction {
    Block,
    Unblock,
    Status,
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
    List,
    Install { id: String, url: Option<String> },
    Delete { id: String },
    Enable { id: String },
    Trust { target: String },
    Untrust { url: String },
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
            PkgAction::List => pkg::list(ctx),
            PkgAction::Install { id, url } => url.as_ref().map_or_else(
                || pkg::install(ctx, id),
                |url| crate::module::install_from_url(&ctx.config_root, id, url),
            ),
            PkgAction::Trust { target } => pkg::trust(ctx, target),
            PkgAction::Untrust { url } => pkg::untrust(ctx, url),
            PkgAction::Delete { id } => crate::module::delete_module(&ctx.config_root, id),
            PkgAction::Enable { id } => crate::module::enable_module(&ctx.config_root, id),
        },
        Command::Protocol(uri) => protocol::run(ctx, uri),
        Command::Sync(target) => sync::run(ctx, target),
        Command::SpotifyUpdates(action) => match action {
            UpdatesAction::Block => updates::set_blocked(ctx, true),
            UpdatesAction::Unblock => updates::set_blocked(ctx, false),
            UpdatesAction::Status => updates::status(ctx),
        },
        Command::Path => diagnostics::path(ctx),
        Command::Support => diagnostics::support(ctx),
        Command::Restart => crate::lifecycle::restart(ctx),
        Command::SelfUpdate => self_update::run(),
    }
}
