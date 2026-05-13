use anyhow::Result;

use crate::config::AppContext;

pub mod apply;
pub mod config;
pub mod daemon;
pub mod dev;
pub mod fix;
pub mod init;
pub mod pkg;
pub mod protocol;
pub mod self_update;
pub mod sync;
pub mod update;

#[derive(Debug, Clone)]
pub enum Command {
    Apply,
    Config,
    Daemon(DaemonAction),
    Dev,
    Fix,
    Init,
    Pkg(PkgAction),
    Protocol(String),
    SelfUpdate,
    Sync,
    Update(UpdateMode),
}

#[derive(Debug, Clone)]
pub enum DaemonAction {
    Start,
    Enable,
    Disable,
    Auto,
}

#[derive(Debug, Clone)]
pub enum PkgAction {
    Install { id: String, url: String },
    Delete { id: String },
    Enable { id: String },
}

#[derive(Debug, Clone, Copy)]
pub enum UpdateMode {
    On,
    Off,
}

pub fn dispatch(cmd: Command, ctx: &AppContext) -> Result<()> {
    match cmd {
        Command::Apply => {
            apply::run(ctx)?;
            crate::logging::info(crate::i18n::lookup("applied_patches"));
            crate::process::restart_if_running(ctx)
        }
        Command::Config => self::config::run(ctx),
        Command::Daemon(action) => match action {
            DaemonAction::Start => {
                crate::logging::info(crate::i18n::lookup("daemon_starting"));
                self::daemon::start(ctx)
            }
            DaemonAction::Enable => {
                crate::logging::info(crate::i18n::lookup("daemon_enabling"));
                self::daemon::enable(ctx)
            }
            DaemonAction::Disable => {
                crate::logging::info(crate::i18n::lookup("daemon_disabling"));
                self::daemon::disable(ctx)
            }
            DaemonAction::Auto => {
                crate::logging::info(crate::i18n::lookup("daemon_starting"));
                self::daemon::auto(ctx)
            }
        },
        Command::Dev => {
            dev::run(ctx)?;
            crate::logging::info(crate::i18n::lookup("app_developer_enabled"));
            crate::process::restart_if_running(ctx)
        }
        Command::Fix => {
            fix::run(ctx)?;
            crate::logging::info(crate::i18n::lookup("restored_stock"));
            crate::process::restart_if_running(ctx)
        }
        Command::Init => {
            init::run(ctx)?;
            crate::logging::info(crate::i18n::lookup("initialized_spicetify"));
            Ok(())
        }
        Command::Pkg(action) => match action {
            PkgAction::Install { id, url } => {
                pkg::install(ctx, &id, &url)?;
                crate::logging::info(crate::i18n::lookup("module_added"));
                Ok(())
            }
            PkgAction::Delete { id } => {
                pkg::delete(ctx, &id)?;
                crate::logging::info(crate::i18n::lookup("module_deleted"));
                Ok(())
            }
            PkgAction::Enable { id } => {
                pkg::enable(ctx, &id)?;
                crate::logging::info(crate::i18n::lookup("module_enabled"));
                Ok(())
            }
        },
        Command::Protocol(uri) => protocol::run(ctx, &uri),
        Command::Sync => {
            sync::run(ctx)?;
            crate::logging::info(crate::i18n::lookup("hooks_updated"));
            Ok(())
        }
        Command::SelfUpdate => self_update::run(),
        Command::Update(mode) => {
            if matches!(mode, UpdateMode::Off) {
                crate::process::stop(ctx)?;
            }
            update::run(ctx, matches!(mode, UpdateMode::On))?;
            crate::logging::info(crate::i18n::lookup("exec_patched"));
            Ok(())
        }
    }
}
