use crossterm::event::{KeyCode, KeyEventKind, KeyModifiers, MouseButton, MouseEventKind};
use spicetify::commands::{Command, PkgAction};

use super::{Action, InputStep, TuiApp};
use crate::components::dialog::{self, DialogHit};
use crate::components::menu_list::MenuAction;

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
            KeyCode::Right | KeyCode::Char('l') | KeyCode::Enter => Action::Select,
            KeyCode::Left | KeyCode::Char('h') | KeyCode::Esc => Action::Back,
            KeyCode::PageUp => Action::ScrollLogUp,
            KeyCode::PageDown => Action::ScrollLogDown,
            _ => return,
        };
        self.dispatch(action);
    }

    pub(crate) fn handle_mouse(&mut self, mouse: crossterm::event::MouseEvent) {
        self.layout.mouse_pos = (mouse.column, mouse.row);

        if self.confirm_quit_open {
            if let MouseEventKind::Up(MouseButton::Left) = mouse.kind {
                match dialog::confirm_quit_hit_test(
                    self.layout.dialog_rect,
                    mouse.column,
                    mouse.row,
                ) {
                    DialogHit::Yes => self.dispatch(Action::ConfirmQuit),
                    DialogHit::No | DialogHit::Background => self.dispatch(Action::CloseDialog),
                }
                return;
            }
            if matches!(mouse.kind, MouseEventKind::Moved) {
                self.menu.hover.on_mouse_move(None);
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
                if self.click_on_back(mouse.column, mouse.row) {
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
                let buffer = std::mem::take(&mut input.buffer);

                if is_pkg_install && matches!(input.step, InputStep::ModuleId) {
                    input.step = InputStep::ModuleUrl(buffer);
                    return;
                }

                let (cmd, label) = match input.action {
                    MenuAction::PkgInstall => {
                        let id = match &input.step {
                            InputStep::ModuleUrl(id) => id.clone(),
                            _ => unreachable!(),
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
                    MenuAction::Protocol => (Command::Protocol(buffer), input.action.label()),
                    _ => unreachable!(),
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
