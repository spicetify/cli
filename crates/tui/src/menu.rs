use spicetify::commands::{Command, DaemonAction, SpotifyAutoUpdate};
use spicetify::fl;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MenuAction {
    Apply,
    Fix,
    Init,
    Sync,
    Dev,
    Config,
    SelfUpdate,
    DaemonStart,
    DaemonStop,
    DaemonInstall,
    DaemonUninstall,
    DaemonStatus,
    BlockUpdates,
    UnblockUpdates,
}

impl MenuAction {
    #[must_use]
    pub fn label(self) -> String {
        match self {
            Self::Apply => fl!("tui-mn-apply"),
            Self::Fix => fl!("tui-mn-fix"),
            Self::Init => fl!("tui-mn-init"),
            Self::Sync => fl!("tui-mn-sync"),
            Self::Dev => fl!("tui-mn-dev"),
            Self::Config => fl!("tui-mn-config"),
            Self::SelfUpdate => fl!("tui-mn-self-update"),
            Self::DaemonStart => fl!("tui-mn-daemon-start"),
            Self::DaemonStop => fl!("tui-mn-daemon-stop"),
            Self::DaemonInstall => fl!("tui-mn-daemon-install"),
            Self::DaemonUninstall => fl!("tui-mn-daemon-uninstall"),
            Self::DaemonStatus => fl!("tui-mn-daemon-status"),
            Self::BlockUpdates => fl!("tui-mn-block-updates"),
            Self::UnblockUpdates => fl!("tui-mn-unblock-updates"),
        }
    }

    #[must_use]
    pub fn description(self) -> String {
        match self {
            Self::Apply => fl!("tui-mn-apply-desc"),
            Self::Fix => fl!("tui-mn-fix-desc"),
            Self::Init => fl!("tui-mn-init-desc"),
            Self::Sync => fl!("tui-mn-sync-desc"),
            Self::Dev => fl!("tui-mn-dev-desc"),
            Self::Config => fl!("tui-mn-config-desc"),
            Self::SelfUpdate => fl!("tui-mn-self-update-desc"),
            Self::DaemonStart => fl!("tui-mn-daemon-start-desc"),
            Self::DaemonStop => fl!("tui-mn-daemon-stop-desc"),
            Self::DaemonInstall => fl!("tui-mn-daemon-install-desc"),
            Self::DaemonUninstall => fl!("tui-mn-daemon-uninstall-desc"),
            Self::DaemonStatus => fl!("tui-mn-daemon-status-desc"),
            Self::BlockUpdates => fl!("tui-mn-block-updates-desc"),
            Self::UnblockUpdates => fl!("tui-mn-unblock-updates-desc"),
        }
    }

    #[must_use]
    pub fn to_command(self) -> Command {
        match self {
            Self::Apply => Command::Apply,
            Self::Fix => Command::Fix,
            Self::Init => Command::Init,
            Self::Sync => Command::Sync,
            Self::Dev => Command::Dev,
            Self::Config => Command::Config,
            Self::SelfUpdate => Command::SelfUpdate,
            Self::DaemonStart => Command::Daemon(DaemonAction::Start),
            Self::DaemonStop => Command::Daemon(DaemonAction::Stop),
            Self::DaemonInstall => Command::Daemon(DaemonAction::Install),
            Self::DaemonUninstall => Command::Daemon(DaemonAction::Uninstall),
            Self::DaemonStatus => Command::Daemon(DaemonAction::Status),
            Self::BlockUpdates => Command::BlockSpotifyUpdates { mode: SpotifyAutoUpdate::Block },
            Self::UnblockUpdates => {
                Command::BlockSpotifyUpdates { mode: SpotifyAutoUpdate::Unblock }
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CategoryId {
    Patching,
    Config,
    SpotifyUpdates,
    Daemon,
}

impl CategoryId {
    #[must_use]
    pub fn label(self) -> String {
        match self {
            Self::Patching => fl!("tui-mn-cat-patching"),
            Self::Config => fl!("tui-mn-cat-config"),
            Self::SpotifyUpdates => fl!("tui-mn-cat-spotify-updates"),
            Self::Daemon => fl!("tui-mn-cat-daemon"),
        }
    }

    #[must_use]
    pub fn description(self) -> String {
        match self {
            Self::Patching => fl!("tui-mn-cat-patching-desc"),
            Self::Config => fl!("tui-mn-cat-config-desc"),
            Self::SpotifyUpdates => fl!("tui-mn-cat-spotify-updates-desc"),
            Self::Daemon => fl!("tui-mn-cat-daemon-desc"),
        }
    }
}

pub(crate) struct MenuCategory {
    pub id: CategoryId,
    pub actions: &'static [MenuAction],
}

pub(crate) const CATEGORIES: &[MenuCategory] = &[
    MenuCategory {
        id: CategoryId::Patching,
        actions: &[
            MenuAction::Apply,
            MenuAction::Fix,
            MenuAction::Init,
            MenuAction::Sync,
            MenuAction::Dev,
        ],
    },
    MenuCategory { id: CategoryId::Config, actions: &[MenuAction::Config, MenuAction::SelfUpdate] },
    MenuCategory {
        id: CategoryId::SpotifyUpdates,
        actions: &[MenuAction::BlockUpdates, MenuAction::UnblockUpdates],
    },
    MenuCategory {
        id: CategoryId::Daemon,
        actions: &[
            MenuAction::DaemonStart,
            MenuAction::DaemonStop,
            MenuAction::DaemonInstall,
            MenuAction::DaemonUninstall,
            MenuAction::DaemonStatus,
        ],
    },
];
