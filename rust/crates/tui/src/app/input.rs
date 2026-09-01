use std::mem;

use crossterm::event::{KeyCode, KeyEventKind, KeyModifiers, MouseButton, MouseEventKind};
use ratatui::layout::Position;
use spicetify::commands::{Command, PkgAction};

use super::{Action, InputStep, TuiApp};
use crate::components::confirm_quit::{self, DialogHit};
use crate::components::menu_list::MenuAction;
use crate::components::primitives::button;

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
            KeyCode::Char('l') if is_ctrl => Action::ClearLog,
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
        if !self.layout.mouse_interactions_enabled() {
            return;
        }

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
                            Command::Pkg(PkgAction::Install { id: id.clone(), url: Some(buffer) }),
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
                if input.buffer.pop().is_none() {
                    tracing::debug!("backspace pressed with empty input buffer");
                }
            }
            KeyCode::Char(c)
                if key.modifiers.is_empty() || key.modifiers == KeyModifiers::SHIFT =>
            {
                input.buffer.push(c);
            }
            _ => {}
        }
    }

    pub(crate) fn click_on_clear(&self, col: u16, row: u16) -> bool {
        self.layout.clear_rect.is_some_and(|r| button::hit_test(r, col, row))
    }

    pub(crate) fn click_on_back(&self, col: u16, row: u16) -> bool {
        self.layout.back_rect.is_some_and(|r| r.contains(Position::new(col, row)))
    }

    pub(crate) fn click_in_menu(&self, col: u16, row: u16) -> bool {
        self.layout.menu_rect.is_some_and(|r| r.contains(Position::new(col, row)))
    }

    pub(crate) fn mouse_in_log(&self, col: u16, row: u16) -> bool {
        self.layout.log_rect.is_some_and(|r| r.contains(Position::new(col, row)))
    }
}

#[cfg(test)]
mod tests {
    use crossterm::event::{KeyModifiers, MouseEvent};

    use super::*;
    use crate::app::{InputState, Page, test_app};

    fn mouse(kind: MouseEventKind) -> MouseEvent {
        MouseEvent { kind, column: 3, row: 4, modifiers: KeyModifiers::NONE }
    }

    #[tokio::test]
    async fn disabled_mouse_interactions_preserve_hidden_state() {
        let mut app = test_app();
        app.layout.clear_interaction_regions();
        app.input = Some(InputState {
            action: MenuAction::PkgDelete,
            buffer: "module-id".to_string(),
            step: InputStep::ModuleId,
        });

        app.handle_mouse(mouse(MouseEventKind::Up(MouseButton::Left)));

        assert_eq!(app.layout.mouse_pos, (3, 4));
        assert_eq!(app.input.as_ref().map(|input| input.buffer.as_str()), Some("module-id"));

        app.input = None;
        app.confirm_quit_open = true;
        app.handle_mouse(mouse(MouseEventKind::Up(MouseButton::Left)));
        assert!(app.confirm_quit_open);

        app.confirm_quit_open = false;
        app.menu.page = Page::Category(0);
        app.handle_mouse(mouse(MouseEventKind::Up(MouseButton::Right)));
        assert_eq!(app.menu.page, Page::Category(0));
    }
}
