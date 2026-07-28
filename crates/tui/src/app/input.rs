use std::mem;

use crossterm::event::{KeyCode, KeyEventKind, KeyModifiers, MouseButton, MouseEventKind};
use spicetify::commands::{Command, PkgAction, SyncTarget};
use spicetify::hooks;
use spicetify::logging::TuiEvent;

use super::{Action, InputStep, TuiApp};
use crate::components::confirm_quit::{self, DialogHit};
use crate::components::menu_list::MenuAction;
use crate::components::primitives::{button, dialog};

impl TuiApp {
    pub(crate) fn handle_key(&mut self, key: crossterm::event::KeyEvent) {
        if key.kind != KeyEventKind::Press {
            return;
        }

        self.menu.hover.on_keyboard();

        if self.confirm_quit_open {
            let is_ctrl = key.modifiers.contains(KeyModifiers::CONTROL);
            let action = match key.code {
                KeyCode::Char('c') if is_ctrl => Some(Action::ConfirmQuit),
                KeyCode::Left | KeyCode::Right | KeyCode::Tab => Some(Action::ToggleDialog),
                KeyCode::Enter | KeyCode::Char('y') if self.confirm_quit_yes => {
                    Some(Action::ConfirmQuit)
                }
                _ => Some(Action::CloseDialog),
            };
            if let Some(action) = action {
                self.dispatch(action);
            }
            return;
        }

        if self.hook_selector.is_some() {
            self.handle_hook_selector_key(key);
            return;
        }

        if self.input.is_some() {
            self.handle_input_key(key);
            return;
        }

        let is_ctrl = key.modifiers.contains(KeyModifiers::CONTROL);
        let action = match key.code {
            KeyCode::Char('c') if is_ctrl => Action::OpenQuitDialog,
            KeyCode::Char('q') => Action::OpenQuitDialog,
            KeyCode::Up | KeyCode::Char('k') => Action::MoveUp,
            KeyCode::Down | KeyCode::Char('j') => Action::MoveDown,
            KeyCode::Home => Action::MoveHome,
            KeyCode::End => Action::MoveEnd,
            KeyCode::Char('l') if is_ctrl => Action::ClearLog,
            KeyCode::Right | KeyCode::Char('l') | KeyCode::Enter => Action::Select,
            KeyCode::Left | KeyCode::Char('h') | KeyCode::Esc => Action::Back,
            KeyCode::PageUp => Action::ScrollLogUp,
            KeyCode::PageDown => Action::ScrollLogDown,
            _ => return,
        };
        self.dispatch(action);
    }

    fn handle_hook_selector_key(&mut self, key: crossterm::event::KeyEvent) {
        match key.code {
            KeyCode::Up | KeyCode::Char('k') => {
                if let Some(ref mut selector) = self.hook_selector {
                    selector.move_up();
                }
            }
            KeyCode::Down | KeyCode::Char('j') => {
                if let Some(ref mut selector) = self.hook_selector {
                    selector.move_down();
                }
            }
            KeyCode::Enter | KeyCode::Char('l') | KeyCode::Right => {
                let Some(selector) = self.hook_selector.take() else { return };
                if selector.is_auto_detect_selected() {
                    let ctx = self.ctx.clone();
                    let tx = self.tx.clone();
                    let _ = tokio::task::spawn_blocking(move || {
                        let resolved = hooks::resolve_hook_sets(selector.sets, &ctx);
                        if tx.send(TuiEvent::HookSetsResolved { resolved }).is_err() {
                            tracing::warn!("hook sets resolved receiver dropped");
                        }
                    });
                } else if let Some(set) = selector.selected_set() {
                    let url = set.download_url.clone();
                    let label = set.display_label();
                    self.run_command(Command::Sync(SyncTarget::Url(url)), &label);
                    self.cmd.current = Some(MenuAction::Sync);
                }
            }
            KeyCode::Esc | KeyCode::Char('h') | KeyCode::Left => {
                self.hook_selector = None;
            }
            _ => {}
        }
    }

    pub(crate) fn handle_mouse(&mut self, mouse: crossterm::event::MouseEvent) {
        self.layout.mouse_pos = (mouse.column, mouse.row);

        if self.confirm_quit_open {
            if let MouseEventKind::Up(MouseButton::Left) = mouse.kind {
                match confirm_quit::confirm_quit_hit_test(
                    self.layout.dialog_rect,
                    mouse.column,
                    mouse.row,
                ) {
                    Some(DialogHit::Yes) => self.dispatch(Action::ConfirmQuit),
                    Some(DialogHit::Close | DialogHit::No | DialogHit::Background) => {
                        self.dispatch(Action::CloseDialog);
                    }
                    None => {}
                }
                return;
            }
            if matches!(mouse.kind, MouseEventKind::Moved) {
                self.menu.hover.on_mouse_move(None);
            }
            return;
        }

        if self.hook_selector.is_some() {
            if let MouseEventKind::Up(MouseButton::Left) = mouse.kind {
                match dialog::dialog_hit_test(self.layout.dialog_rect, mouse.column, mouse.row) {
                    dialog::DialogAreaHit::Close | dialog::DialogAreaHit::Background => {
                        self.hook_selector = None;
                    }
                    dialog::DialogAreaHit::Inside => {}
                }
            }
            return;
        }

        if self.input.is_some() {
            if let MouseEventKind::Up(MouseButton::Left) = mouse.kind {
                self.dispatch(Action::CancelInput);
            }
            return;
        }

        match mouse.kind {
            MouseEventKind::ScrollDown => {
                if self.click_in_menu(mouse.column, mouse.row) {
                    self.dispatch(Action::ScrollMenuDown);
                } else if self.mouse_in_log(mouse.column, mouse.row) {
                    self.dispatch(Action::ScrollLogDown);
                }
            }
            MouseEventKind::ScrollUp => {
                if self.click_in_menu(mouse.column, mouse.row) {
                    self.dispatch(Action::ScrollMenuUp);
                } else if self.mouse_in_log(mouse.column, mouse.row) {
                    self.dispatch(Action::ScrollLogUp);
                }
            }
            MouseEventKind::Up(MouseButton::Left) => {
                if self.click_on_clear(mouse.column, mouse.row) {
                    self.dispatch(Action::ClearLog);
                } else if self.click_on_back(mouse.column, mouse.row) {
                    self.dispatch(Action::Back);
                } else if self.click_in_menu(mouse.column, mouse.row) {
                    let rect =
                        self.layout.menu_rect.expect("menu_rect set when click_in_menu true");
                    if let Some(idx) = self.menu.click_index(mouse.column, mouse.row, rect) {
                        self.dispatch(Action::SelectMenu(idx));
                    }
                }
            }
            MouseEventKind::Up(MouseButton::Right) => self.dispatch(Action::Back),
            MouseEventKind::Moved => {
                let rect = self.layout.menu_rect;
                let hovered =
                    rect.and_then(|r| self.menu.hovered_index(mouse.column, mouse.row, r));
                self.menu.hover.on_mouse_move(hovered);
            }
            _ => {}
        }
    }

    pub(crate) fn handle_input_key(&mut self, key: crossterm::event::KeyEvent) {
        let Some(input) = &mut self.input else { return };
        let is_pkg_install = input.action == MenuAction::PkgInstall;

        match key.code {
            KeyCode::Esc => {
                self.input = None;
            }
            KeyCode::Enter => {
                let buffer = mem::take(&mut input.buffer);

                if is_pkg_install && matches!(input.step, InputStep::ModuleId) {
                    input.step = InputStep::ModuleUrl(buffer);
                    return;
                }

                let (cmd, label) = match input.action {
                    MenuAction::PkgInstall => {
                        let id = match &input.step {
                            InputStep::ModuleUrl(id) => id.clone(),
                            InputStep::ModuleId => unreachable!(),
                        };
                        (
                            Command::Pkg(PkgAction::Install { id: id.clone(), url: buffer }),
                            format!("pkg install {id}"),
                        )
                    }
                    MenuAction::PkgDelete => {
                        (Command::Pkg(PkgAction::Delete { id: buffer }), input.action.label())
                    }
                    MenuAction::PkgEnable => {
                        (Command::Pkg(PkgAction::Enable { id: buffer }), input.action.label())
                    }
                    _ => unreachable!("only PkgInstall/PkgDelete/PkgEnable reach handle_input_key"),
                };
                self.input = None;
                self.run_command(cmd, &label);
            }
            KeyCode::Backspace => {
                let _ = input.buffer.pop();
            }
            KeyCode::Char(c) => {
                input.buffer.push(c);
            }
            _ => {}
        }
    }

    pub(crate) fn click_on_clear(&self, col: u16, row: u16) -> bool {
        self.layout.clear_rect.is_some_and(|r| button::hit_test(r, col, row))
    }

    pub(crate) fn click_on_back(&self, col: u16, row: u16) -> bool {
        let Some(rect) = self.layout.back_rect else { return false };
        col >= rect.x
            && col < rect.x.saturating_add(rect.width)
            && row >= rect.y
            && row < rect.y.saturating_add(rect.height)
    }

    pub(crate) fn click_in_menu(&self, col: u16, row: u16) -> bool {
        let Some(rect) = self.layout.menu_rect else { return false };
        col >= rect.x
            && col < rect.x.saturating_add(rect.width)
            && row >= rect.y
            && row < rect.y.saturating_add(rect.height)
    }

    pub(crate) fn mouse_in_log(&self, col: u16, row: u16) -> bool {
        let Some(rect) = self.layout.log_rect else { return false };
        col >= rect.x
            && col < rect.x.saturating_add(rect.width)
            && row >= rect.y
            && row < rect.y.saturating_add(rect.height)
    }
}
