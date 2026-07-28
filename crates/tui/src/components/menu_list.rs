use ratatui::Frame;
use ratatui::layout::Rect;
use ratatui::style::Style;
use ratatui::text::{Line, Span};
use ratatui::widgets::{List, ListItem, ListState};
use spicetify::commands::{Command, ConfigAction, DaemonAction, SyncTarget};
use spicetify::fl;

use super::super::app::{HoverState, Page};
use crate::theme;

const SCROLL_STEP: usize = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum MenuAction {
    Apply,
    Restore,
    Sync,
    Dev,
    Config,
    ConfigOpenFolder,
    SelfUpdate,
    DaemonStart,
    DaemonStop,
    DaemonInstall,
    DaemonUninstall,
    DaemonStatus,
    PkgInstall,
    PkgDelete,
    PkgEnable,
}

impl MenuAction {
    #[must_use]
    pub(crate) fn label(self) -> String {
        match self {
            Self::Apply => fl!("tui-mn-apply"),
            Self::Restore => fl!("tui-mn-restore"),
            Self::Sync => fl!("tui-mn-sync"),
            Self::Dev => fl!("tui-mn-dev"),
            Self::Config => fl!("tui-mn-config"),
            Self::ConfigOpenFolder => fl!("tui-mn-config-open-folder"),
            Self::SelfUpdate => fl!("tui-mn-self-update"),
            Self::DaemonStart => fl!("tui-mn-daemon-start"),
            Self::DaemonStop => fl!("tui-mn-daemon-stop"),
            Self::DaemonInstall => fl!("tui-mn-daemon-install"),
            Self::DaemonUninstall => fl!("tui-mn-daemon-uninstall"),
            Self::DaemonStatus => fl!("tui-mn-daemon-status"),
            Self::PkgInstall => fl!("tui-mn-pkg-install"),
            Self::PkgDelete => fl!("tui-mn-pkg-delete"),
            Self::PkgEnable => fl!("tui-mn-pkg-enable"),
        }
    }

    #[must_use]
    pub(crate) fn description(self) -> String {
        match self {
            Self::Apply => fl!("tui-mn-apply-desc"),
            Self::Restore => fl!("tui-mn-restore-desc"),
            Self::Sync => fl!("tui-mn-sync-desc"),
            Self::Dev => fl!("tui-mn-dev-desc"),
            Self::Config => fl!("tui-mn-config-desc"),
            Self::ConfigOpenFolder => fl!("tui-mn-config-open-folder-desc"),
            Self::SelfUpdate => fl!("tui-mn-self-update-desc"),
            Self::DaemonStart => fl!("tui-mn-daemon-start-desc"),
            Self::DaemonStop => fl!("tui-mn-daemon-stop-desc"),
            Self::DaemonInstall => fl!("tui-mn-daemon-install-desc"),
            Self::DaemonUninstall => fl!("tui-mn-daemon-uninstall-desc"),
            Self::DaemonStatus => fl!("tui-mn-daemon-status-desc"),
            Self::PkgInstall => fl!("tui-mn-pkg-install-desc"),
            Self::PkgDelete => fl!("tui-mn-pkg-delete-desc"),
            Self::PkgEnable => fl!("tui-mn-pkg-enable-desc"),
        }
    }

    #[must_use]
    pub(crate) fn to_command(self) -> Command {
        match self {
            Self::Apply => Command::Apply,
            Self::Restore => Command::Restore,
            Self::Sync => Command::Sync(SyncTarget::Auto),
            Self::Dev => Command::Dev,
            Self::Config => Command::Config(ConfigAction::Show),
            Self::ConfigOpenFolder => Command::Config(ConfigAction::OpenFolder),
            Self::SelfUpdate => Command::SelfUpdate,
            Self::DaemonStart => Command::Daemon(DaemonAction::Start),
            Self::DaemonStop => Command::Daemon(DaemonAction::Stop),
            Self::DaemonInstall => Command::Daemon(DaemonAction::Install),
            Self::DaemonUninstall => Command::Daemon(DaemonAction::Uninstall),
            Self::DaemonStatus => Command::Daemon(DaemonAction::Status),
            Self::PkgInstall | Self::PkgDelete | Self::PkgEnable => {
                unreachable!("input actions are handled separately")
            }
        }
    }

    #[must_use]
    pub(crate) fn needs_input(self) -> bool {
        matches!(self, Self::PkgInstall | Self::PkgDelete | Self::PkgEnable)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CategoryId {
    Patching,
    Pkg,
    Config,
    Daemon,
}

impl CategoryId {
    #[must_use]
    pub(crate) fn label(self) -> String {
        match self {
            Self::Patching => fl!("tui-mn-cat-patching"),
            Self::Pkg => fl!("tui-mn-cat-pkg"),
            Self::Config => fl!("tui-mn-cat-config"),
            Self::Daemon => fl!("tui-mn-cat-daemon"),
        }
    }

    #[must_use]
    pub(crate) fn description(self) -> String {
        match self {
            Self::Patching => fl!("tui-mn-cat-patching-desc"),
            Self::Pkg => fl!("tui-mn-cat-pkg-desc"),
            Self::Config => fl!("tui-mn-cat-config-desc"),
            Self::Daemon => fl!("tui-mn-cat-daemon-desc"),
        }
    }
}

pub(crate) struct MenuCategory {
    pub(crate) id: CategoryId,
    pub(crate) actions: &'static [MenuAction],
}

impl MenuCategory {
    pub(crate) fn action_at(&self, index: usize) -> Option<MenuAction> {
        self.actions.get(index).copied()
    }
}

pub(crate) const CATEGORIES: &[MenuCategory] = &[
    MenuCategory {
        id: CategoryId::Patching,
        actions: &[MenuAction::Apply, MenuAction::Restore, MenuAction::Sync, MenuAction::Dev],
    },
    MenuCategory {
        id: CategoryId::Pkg,
        actions: &[MenuAction::PkgInstall, MenuAction::PkgDelete, MenuAction::PkgEnable],
    },
    MenuCategory {
        id: CategoryId::Config,
        actions: &[MenuAction::Config, MenuAction::ConfigOpenFolder, MenuAction::SelfUpdate],
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

#[derive(Debug, Clone, Copy)]
pub(crate) enum ActivateResult {
    EnterCategory,
    RunAction(MenuAction),
}

#[derive(Debug)]
pub(crate) struct MenuList {
    pub(crate) page: Page,
    pub(crate) selected: usize,
    pub(crate) main_selected: usize,
    pub(crate) scroll: usize,
    pub(crate) hover: HoverState,
    list_state: ListState,
    main_labels: Vec<String>,
    action_labels_by_category: Vec<Vec<String>>,
}

impl MenuList {
    pub(crate) fn new() -> Self {
        let mut list = ListState::default();
        list.select(Some(0));

        let main_labels = CATEGORIES.iter().map(|c| c.id.label()).collect();
        let action_labels_by_category: Vec<Vec<String>> =
            CATEGORIES.iter().map(|c| c.actions.iter().map(|a| a.label()).collect()).collect();

        Self {
            page: Page::Main,
            selected: 0,
            main_selected: 0,
            scroll: 0,
            hover: HoverState::new(),
            list_state: list,
            main_labels,
            action_labels_by_category,
        }
    }

    pub(crate) fn item_count(&self) -> usize {
        match self.page {
            Page::Main => CATEGORIES.len(),
            Page::Category(i) => CATEGORIES.get(i).map_or(0, |c| c.actions.len()),
        }
    }

    pub(crate) fn labels(&self) -> &[String] {
        match self.page {
            Page::Main => &self.main_labels,
            Page::Category(i) => {
                self.action_labels_by_category.get(i).map_or(&[] as &[String], |v| v.as_slice())
            }
        }
    }

    pub(crate) fn details_lines(&self) -> Vec<String> {
        match self.page {
            Page::Main => CATEGORIES
                .get(self.selected)
                .map_or_else(|| vec![String::new()], |c| vec![c.id.label(), c.id.description()]),
            Page::Category(i) => CATEGORIES
                .get(i)
                .and_then(|c| c.action_at(self.selected))
                .map_or_else(|| vec![String::new()], |a| vec![a.label(), a.description()]),
        }
    }

    #[expect(clippy::cast_possible_wrap)]
    pub(crate) fn move_selection(&mut self, delta: isize) {
        let len = self.item_count();
        if len == 0 {
            return;
        }
        let cur = self.selected as isize + delta;
        let next = cur.rem_euclid(len as isize) as usize;
        self.select(next);
    }

    pub(crate) fn select(&mut self, idx: usize) {
        self.selected = idx;
        self.list_state.select(Some(idx));
    }

    pub(crate) fn activate(&mut self) -> Option<ActivateResult> {
        match self.page {
            Page::Main => {
                let cat = CATEGORIES.get(self.selected)?;
                if cat.actions.is_empty() {
                    return None;
                }
                self.main_selected = self.selected;
                self.page = Page::Category(self.selected);
                self.selected = 0;
                self.scroll = 0;
                self.list_state.select(Some(0));
                Some(ActivateResult::EnterCategory)
            }
            Page::Category(i) => {
                let action = CATEGORIES.get(i).and_then(|c| c.action_at(self.selected))?;
                Some(ActivateResult::RunAction(action))
            }
        }
    }

    pub(crate) fn go_back(&mut self) {
        if let Page::Category(_) = self.page {
            self.page = Page::Main;
            self.selected = self.main_selected;
            self.list_state.select(Some(self.main_selected));
            self.scroll = 0;
        }
    }

    pub(crate) fn scroll_up(&mut self, _visible: usize) {
        self.scroll = self.scroll.saturating_sub(SCROLL_STEP);
    }

    pub(crate) fn scroll_down(&mut self, visible: usize) {
        let total = self.item_count();
        let max_scroll = total.saturating_sub(visible);
        self.scroll = (self.scroll + SCROLL_STEP).min(max_scroll);
    }

    pub(crate) fn ensure_visible(&mut self, visible: usize) {
        if visible == 0 {
            return;
        }
        let last = visible.saturating_sub(1);
        if self.selected < self.scroll {
            self.scroll = self.selected;
        } else if self.selected >= self.scroll + visible {
            self.scroll = self.selected.saturating_sub(last);
        }
    }

    pub(crate) fn click_index(&self, col: u16, row: u16, area: Rect) -> Option<usize> {
        if !Self::rect_contains(area, col, row) {
            return None;
        }
        let visible_row = row.saturating_sub(area.y) as usize;
        let real_idx = visible_row + self.scroll;
        if real_idx < self.item_count() { Some(real_idx) } else { None }
    }

    pub(crate) fn hovered_index(&self, col: u16, row: u16, area: Rect) -> Option<usize> {
        if col < area.x.saturating_add(1)
            || col >= area.x.saturating_add(area.width).saturating_sub(1)
            || row < area.y
        {
            return None;
        }
        let visible_row = row.saturating_sub(area.y) as usize;
        if visible_row >= area.height as usize {
            return None;
        }
        let real_idx = visible_row + self.scroll;
        if real_idx < self.item_count() { Some(real_idx) } else { None }
    }

    fn rect_contains(area: Rect, col: u16, row: u16) -> bool {
        col >= area.x
            && col < area.x.saturating_add(area.width)
            && row >= area.y
            && row < area.y.saturating_add(area.height)
    }

    pub(crate) fn render(&mut self, frame: &mut Frame<'_>, area: Rect) {
        let labels = self.labels();
        if labels.is_empty() {
            return;
        }

        let visible = area.height.max(1) as usize;
        let total = labels.len();
        let start = self.scroll.min(total.saturating_sub(1));
        let end = (start + visible).min(total);

        let active_idx = if self.hover.is_mouse_active() {
            self.hover.index
        } else {
            self.list_state.selected()
        };

        let items: Vec<ListItem<'_>> = labels
            .get(start..end)
            .unwrap_or(&[])
            .iter()
            .enumerate()
            .map(|(vi, label)| {
                let real_idx = start + vi;
                let highlight = if Some(real_idx) == active_idx {
                    theme::highlight()
                } else {
                    Style::default()
                };
                let kb_selected =
                    !self.hover.is_mouse_active() && Some(real_idx) == self.list_state.selected();
                let prefix = if kb_selected { " ▸ " } else { "   " };
                let text = format!("{prefix}{label}");
                ListItem::new(Line::from(Span::styled(text, highlight)))
            })
            .collect();

        let list = List::new(items);
        frame.render_widget(list, area);
    }
}
