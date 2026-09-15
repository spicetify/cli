use crate::context::AppContext;
use crate::error::Result;

pub mod apply;
mod config;
mod daemon;
mod dev;
mod diagnostics;
pub mod guard;
mod init;
mod pkg;
pub mod protocol;
mod restore;
mod self_update;
pub mod updates;

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
}

pub fn dispatch(cmd: &Command, ctx: &AppContext) -> Result<()> {
    match cmd {
        Command::Apply => {
            let guard = guard::try_acquire(&ctx.config_root)?;
            apply::run(ctx, &guard)
        }
        Command::Config(action) => match action {
            ConfigAction::Show => config::run(ctx),
            ConfigAction::OpenFolder => config::open_folder(ctx),
        },
        Command::Daemon(action) => match action {
            DaemonAction::Start => daemon::start(),
            DaemonAction::Stop => {
                let _guard = guard::try_acquire(&ctx.config_root)?;
                daemon::stop()
            }
            DaemonAction::Install => daemon::install(),
            DaemonAction::Uninstall => {
                let _guard = guard::try_acquire(&ctx.config_root)?;
                daemon::uninstall()
            }
            DaemonAction::Status => daemon::status(),
        },
        Command::Dev => dev::run(ctx),
        Command::Restore => {
            let _guard = guard::try_acquire(&ctx.config_root)?;
            restore::run(ctx)
        }
        Command::Init => {
            let _guard = guard::try_acquire(&ctx.config_root)?;
            init::run(ctx)
        }
        Command::Pkg(action) => {
            let _guard = match action {
                PkgAction::List => None,
                _ => Some(guard::try_acquire(&ctx.config_root)?),
            };
            match action {
                PkgAction::List => pkg::list(ctx),
                PkgAction::Install { id, url } => url.as_ref().map_or_else(
                    || pkg::install(ctx, id),
                    |url| crate::module::install_from_url(&ctx.config_root, id, url),
                ),
                PkgAction::Delete { id } => crate::module::delete_module(&ctx.config_root, id),
                PkgAction::Enable { id } => crate::module::enable_module(&ctx.config_root, id),
            }
        }
        Command::Protocol(uri) => protocol::run(ctx, uri),
        Command::SpotifyUpdates(UpdatesAction::Status) => updates::status(ctx),
        Command::SpotifyUpdates(action) => {
            let _guard = guard::try_acquire(&ctx.config_root)?;
            match action {
                UpdatesAction::Block => updates::set_blocked_and_remember(ctx, true),
                UpdatesAction::Unblock => updates::set_blocked_and_remember(ctx, false),
                UpdatesAction::Status => unreachable!("handled above"),
            }
        }
        Command::Path => diagnostics::path(ctx),
        Command::Support => diagnostics::support(ctx),
        Command::Restart => {
            let _guard = guard::try_acquire(&ctx.config_root)?;
            crate::lifecycle::restart(ctx)
        }
        Command::SelfUpdate => self_update::run(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn package_mutations_cannot_race_an_existing_operation() -> Result<()> {
        let mut nonce = [0; 16];
        getrandom::fill(&mut nonce)?;
        let root =
            std::env::temp_dir().join(format!("spicetify-package-lock-{}", hex::encode(nonce)));
        std::fs::create_dir(&root)?;
        std::fs::create_dir_all(root.join("store/module/1"))?;
        std::fs::write(root.join("store/module/1/keep.txt"), "package")?;
        let ctx = AppContext::from_config(root.clone(), &crate::context::Config::default())?;
        let guard = guard::try_acquire(&root)?;
        for action in [
            PkgAction::Install { id: "module@1".to_string(), url: None },
            PkgAction::Delete { id: "module@1".to_string() },
            PkgAction::Enable { id: "module@1".to_string() },
        ] {
            let error = dispatch(&Command::Pkg(action), &ctx).expect_err("competing mutation");
            assert!(error.to_string().contains("already in progress"), "{error}");
        }
        for action in [
            "add",
            "install",
            "enable",
            "delete",
            "remove",
            "fast-install",
            "fast-enable",
            "fast-delete",
            "fast-remove",
        ] {
            let error = protocol::handle(&ctx, &format!("spicetify:0:{action}?id=module%401"))
                .expect_err("competing protocol mutation");
            assert!(error.to_string().contains("already in progress"), "{error}");
        }
        let error =
            dispatch(&Command::Init, &ctx).expect_err("initialization replaces package state");
        assert!(error.to_string().contains("already in progress"), "{error}");
        dispatch(&Command::Pkg(PkgAction::List), &ctx)?;
        let retained = root.join("store/module/1/keep.txt").is_file();
        assert!(!root.join("modules").exists(), "blocked operations must not mutate the vault");
        drop(guard);
        dispatch(&Command::Pkg(PkgAction::Delete { id: "module@1".to_string() }), &ctx)?;
        assert!(
            !root.join("store/module/1").exists(),
            "deletion resumes after the lock is released"
        );
        std::fs::remove_dir_all(&root)?;
        assert!(retained, "deletion ran while another operation owned the store");
        Ok(())
    }
}
