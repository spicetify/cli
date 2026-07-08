use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Receiver;
use std::time::{Duration, Instant};

use anyhow::Result;
use crossterm::event::{Event, KeyCode, KeyEventKind, KeyModifiers, MouseButton, MouseEventKind};
use futures_util::StreamExt;
use ratatui::Terminal;
use ratatui::backend::Backend;
use ratatui::layout::Rect;
use ratatui::widgets::ListState;
use spicetify::commands::{Command, PkgAction};
use spicetify::context::AppContext;
use spicetify::logging::{TuiEvent, TuiEventSender};
use spicetify::{daemon, fl};
use tokio::sync::broadcast;

use crate::frame_scheduler::FrameRequester;
use crate::log_buffer::LogBuffer;
use crate::menu::{CATEGORIES, MenuAction, MenuCategory};
use crate::render;
use crate::theme::SPINNER_FRAMES;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RunStatus {
    Idle,
    Running,
    Ok,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Page {
    Main,
    Category(usize),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum InputSource {
    Keyboard,
    Mouse,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct HoverState {
    pub(crate) index: Option<usize>,
    source: InputSource,
}

impl HoverState {
    fn new() -> Self {
        Self { index: None, source: InputSource::Keyboard }
    }

    fn on_keyboard(&mut self) {
        self.source = InputSource::Keyboard;
        self.index = None;
    }

    fn on_mouse_move(&mut self, idx: Option<usize>) {
        self.source = InputSource::Mouse;
        self.index = idx;
    }

    #[must_use]
    pub(crate) fn is_mouse_active(&self) -> bool {
        self.source == InputSource::Mouse
    }
}

#[derive(Debug, Clone, Copy)]
enum Action {
    MoveUp,
    MoveDown,
    MoveHome,
    MoveEnd,
    Select,
    Back,
    OpenQuitDialog,
    ConfirmQuit,
    CloseDialog,
    ToggleDialog,
    CancelInput,
    SelectMenu(usize),
}

#[derive(Debug)]
pub(crate) struct Navigation {
    pub(crate) page: Page,
    pub(crate) selected: usize,
    pub(crate) main_selected: usize,
}

#[derive(Debug)]
pub(crate) struct CommandState {
    pub(crate) current: Option<MenuAction>,
    pub(crate) status: RunStatus,
    pub(crate) last_started_at: Option<Instant>,
}

#[derive(Debug)]
pub(crate) struct Dialog {
    pub(crate) confirm_quit: bool,
    pub(crate) confirm_quit_yes: bool,
}

#[derive(Debug)]
struct Animation {
    spinner_frame: usize,
    last_spinner_tick: Instant,
}

#[derive(Debug)]
pub(crate) enum InputStep {
    ModuleId,
    ModuleUrl(String),
    ProtocolUri,
}

#[derive(Debug)]
pub(crate) struct InputState {
    pub(crate) action: MenuAction,
    pub(crate) buffer: String,
    pub(crate) step: InputStep,
}

impl InputState {
    pub(crate) fn prompt(&self) -> String {
        match self.step {
            InputStep::ModuleId => fl!("tui-input-module-id"),
            InputStep::ModuleUrl(_) => fl!("tui-input-module-url"),
            InputStep::ProtocolUri => fl!("tui-input-protocol-uri"),
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct LayoutState {
    pub menu_rect: Option<Rect>,
    pub body_rect: Option<Rect>,
    pub(crate) hover: HoverState,
    pub(crate) back_rect: Option<Rect>,
    pub(crate) dialog_rect: Option<Rect>,
    pub(crate) mouse_pos: (u16, u16),
}

#[derive(Debug)]
pub struct TuiApp {
    pub ctx: AppContext,
    should_quit: bool,

    pub(crate) nav: Navigation,
    pub(crate) dialog: Dialog,
    pub(crate) cmd: CommandState,
    pub(crate) input: Option<InputState>,
    anim: Animation,

    pub daemon_running: bool,
    pub daemon_installed: bool,

    pub logs: LogBuffer,
    pub layout: LayoutState,

    pub tx: TuiEventSender,
    rx: Receiver<TuiEvent>,

    pub list_state: ListState,

    frame_requester: FrameRequester,
    draw_tx: broadcast::Sender<()>,
}

impl TuiApp {
    #[must_use]
    pub(crate) fn new(
        ctx: AppContext,
        tx: TuiEventSender,
        rx: Receiver<TuiEvent>,
        frame_requester: FrameRequester,
        draw_tx: broadcast::Sender<()>,
    ) -> Self {
        let now = Instant::now();
        let mut list = ListState::default();
        list.select(Some(0));

        Self {
            ctx,
            should_quit: false,
            nav: Navigation { page: Page::Main, selected: 0, main_selected: 0 },
            dialog: Dialog { confirm_quit: false, confirm_quit_yes: true },
            cmd: CommandState { current: None, status: RunStatus::Idle, last_started_at: None },
            input: None,
            anim: Animation { spinner_frame: 0, last_spinner_tick: now },
            daemon_running: daemon::is_daemon_running(),
            daemon_installed: daemon::manager::create().is_installed(),
            logs: LogBuffer::new(400),
            layout: LayoutState {
                menu_rect: None,
                body_rect: None,
                hover: HoverState::new(),
                back_rect: None,
                dialog_rect: None,
                mouse_pos: (0, 0),
            },
            tx,
            rx,
            list_state: list,
            frame_requester,
            draw_tx,
        }
    }

    #[must_use]
    pub fn menu_labels(&self) -> Vec<String> {
        self.active_category().map_or_else(
            || CATEGORIES.iter().map(|c| c.id.label()).collect(),
            |cat| cat.actions.iter().map(|a| a.label()).collect(),
        )
    }

    #[must_use]
    pub fn details_lines(&self) -> Vec<String> {
        match self.nav.page {
            Page::Main => CATEGORIES
                .get(self.nav.selected)
                .map_or_else(|| vec![String::new()], |c| vec![c.id.label(), c.id.description()]),
            Page::Category(i) => CATEGORIES
                .get(i)
                .and_then(|c| c.action_at(self.nav.selected))
                .map_or_else(|| vec![String::new()], |a| vec![a.label(), a.description()]),
        }
    }

    #[must_use]
    pub fn is_navigable(&self) -> bool {
        matches!(self.nav.page, Page::Main)
    }

    #[must_use]
    pub(crate) fn spinner_glyph(&self) -> &'static str {
        SPINNER_FRAMES.get(self.anim.spinner_frame % SPINNER_FRAMES.len()).copied().unwrap_or("⠋")
    }

    fn active_category(&self) -> Option<&MenuCategory> {
        match self.nav.page {
            Page::Main => None,
            Page::Category(i) => CATEGORIES.get(i),
        }
    }

    fn items_len(&self) -> usize {
        match self.nav.page {
            Page::Main => CATEGORIES.len(),
            Page::Category(i) => CATEGORIES.get(i).map_or(0, |c| c.actions.len()),
        }
    }

    pub async fn run_async<B: Backend>(&mut self, terminal: &mut Terminal<B>) -> Result<()>
    where
        <B as Backend>::Error: std::fmt::Debug + Send + Sync + 'static,
    {
        let daemon_running = Arc::new(AtomicBool::new(self.daemon_running));
        let daemon_installed = Arc::new(AtomicBool::new(self.daemon_installed));

        let mut draw_rx = self.draw_tx.subscribe();

        {
            let dr = daemon_running.clone();
            let di = daemon_installed.clone();
            let fr = self.frame_requester.clone();
            let _watcher = tokio::spawn(async move {
                loop {
                    tokio::time::sleep(Duration::from_secs(1)).await;
                    let prev_running = dr.load(Ordering::Acquire);
                    let prev_installed = di.load(Ordering::Acquire);
                    if let Ok(running) =
                        tokio::task::spawn_blocking(daemon::is_daemon_running).await
                    {
                        if running != prev_running {
                            fr.schedule();
                        }
                        dr.store(running, Ordering::Release);
                    }
                    if let Ok(installed) =
                        tokio::task::spawn_blocking(|| daemon::manager::create().is_installed())
                            .await
                    {
                        if installed != prev_installed {
                            fr.schedule();
                        }
                        di.store(installed, Ordering::Release);
                    }
                }
            });
        }

        let mut events = crossterm::event::EventStream::new();
        let mut needs_draw = true;

        loop {
            if self.should_quit {
                return Ok(());
            }

            if needs_draw {
                terminal.draw(|frame| render::draw(frame, self)).map(|_| ())?;
                needs_draw = false;
                if self.cmd.status == RunStatus::Running {
                    self.frame_requester.schedule_in(Duration::from_millis(80));
                }
            }

            tokio::select! {
                event = events.next() => {
                    match event {
                        Some(Ok(Event::Key(key))) => {
                            self.handle_key(key);
                            needs_draw = true;
                        }
                        Some(Ok(Event::Mouse(mouse))) => {
                            self.handle_mouse(mouse);
                            needs_draw = true;
                        }
                        _ => {}
                    }
                }
                draw_result = draw_rx.recv() => {
                    match draw_result {
                        Ok(()) | Err(broadcast::error::RecvError::Lagged(_)) => {
                            needs_draw = true;
                        }
                        Err(broadcast::error::RecvError::Closed) => break,
                    }
                }
            }

            let running = daemon_running.load(Ordering::Acquire);
            let installed = daemon_installed.load(Ordering::Acquire);
            if running != self.daemon_running || installed != self.daemon_installed {
                self.daemon_running = running;
                self.daemon_installed = installed;
                needs_draw = true;
            }
            if self.tick_animation() {
                needs_draw = true;
            }
            if self.drain_events() {
                needs_draw = true;
            }
        }

        Ok(())
    }

    fn tick_animation(&mut self) -> bool {
        let now = Instant::now();
        if self.anim.last_spinner_tick.elapsed() >= Duration::from_millis(80) {
            self.anim.spinner_frame = (self.anim.spinner_frame + 1) % SPINNER_FRAMES.len();
            self.anim.last_spinner_tick = now;
            return true;
        }
        false
    }

    fn handle_key(&mut self, key: crossterm::event::KeyEvent) {
        if key.kind != KeyEventKind::Press {
            return;
        }

        self.layout.hover.on_keyboard();

        if self.dialog.confirm_quit {
            let is_ctrl = key.modifiers.contains(KeyModifiers::CONTROL);
            let action = match key.code {
                KeyCode::Char('c') if is_ctrl => Some(Action::ConfirmQuit),
                KeyCode::Left | KeyCode::Right | KeyCode::Tab => Some(Action::ToggleDialog),
                KeyCode::Enter | KeyCode::Char('y') if self.dialog.confirm_quit_yes => {
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
            _ => return,
        };
        self.dispatch(action);
    }

    fn handle_mouse(&mut self, mouse: crossterm::event::MouseEvent) {
        self.layout.mouse_pos = (mouse.column, mouse.row);

        if self.dialog.confirm_quit {
            if let MouseEventKind::Up(MouseButton::Left) = mouse.kind {
                if self.click_dialog_yes(mouse.column, mouse.row) {
                    self.dispatch(Action::ConfirmQuit);
                } else {
                    self.dispatch(Action::CloseDialog);
                }
                return;
            }
            if matches!(mouse.kind, MouseEventKind::Moved) {
                self.layout.hover.on_mouse_move(None);
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
            MouseEventKind::Up(MouseButton::Left) => {
                if self.click_on_back(mouse.column, mouse.row) {
                    self.dispatch(Action::Back);
                } else if self.click_in_menu(mouse.column, mouse.row) {
                    let rect =
                        self.layout.menu_rect.expect("menu_rect set when click_in_menu true");
                    let row = mouse.row.saturating_sub(rect.y) as usize;
                    if row < self.items_len() {
                        self.dispatch(Action::SelectMenu(row));
                    }
                }
            }
            MouseEventKind::Up(MouseButton::Right) => self.dispatch(Action::Back),
            MouseEventKind::Moved => {
                self.layout.hover.on_mouse_move(self.compute_hovered_row());
            }
            _ => {}
        }
    }

    fn handle_input_key(&mut self, key: crossterm::event::KeyEvent) {
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
                            Command::Pkg {
                                action: PkgAction::Install { id: id.clone(), url: buffer },
                            },
                            format!("pkg install {id}"),
                        )
                    }
                    MenuAction::PkgDelete => (
                        Command::Pkg { action: PkgAction::Delete { id: buffer } },
                        input.action.label(),
                    ),
                    MenuAction::PkgEnable => (
                        Command::Pkg { action: PkgAction::Enable { id: buffer } },
                        input.action.label(),
                    ),
                    MenuAction::Protocol => {
                        (Command::Protocol { uri: buffer }, input.action.label())
                    }
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

    fn dispatch(&mut self, action: Action) {
        match action {
            Action::MoveUp => self.move_selection(-1),
            Action::MoveDown => self.move_selection(1),
            Action::MoveHome => {
                self.nav.selected = 0;
                self.list_state.select(Some(0));
            }
            Action::MoveEnd => {
                let last = self.items_len().saturating_sub(1);
                self.nav.selected = last;
                self.list_state.select(Some(last));
            }
            Action::Select => self.activate(),
            Action::Back => self.go_back(),
            Action::OpenQuitDialog => {
                self.dialog.confirm_quit = true;
                self.dialog.confirm_quit_yes = true;
            }
            Action::ConfirmQuit => self.should_quit = true,
            Action::CloseDialog => self.dialog.confirm_quit = false,
            Action::ToggleDialog => {
                self.dialog.confirm_quit_yes = !self.dialog.confirm_quit_yes;
            }
            Action::CancelInput => self.input = None,
            Action::SelectMenu(idx) => {
                self.nav.selected = idx;
                self.list_state.select(Some(idx));
                self.activate();
            }
        }
    }

    fn click_on_back(&self, col: u16, row: u16) -> bool {
        let Some(rect) = self.layout.back_rect else { return false };
        col >= rect.x
            && col < rect.x.saturating_add(rect.width)
            && row >= rect.y
            && row < rect.y.saturating_add(rect.height)
    }

    fn click_dialog_yes(&self, col: u16, row: u16) -> bool {
        let Some(dialog) = self.layout.dialog_rect else { return false };
        let inner = Rect {
            x: dialog.x + 1,
            y: dialog.y + 1,
            width: dialog.width.saturating_sub(2),
            height: dialog.height.saturating_sub(2),
        };
        if row != inner.y + 3 {
            return false;
        }
        let yes_x = inner.x + (inner.width.saturating_sub(16)) / 2;
        col >= yes_x && col < yes_x + 6
    }

    fn click_in_menu(&self, col: u16, row: u16) -> bool {
        let Some(rect) = self.layout.menu_rect else { return false };
        col >= rect.x
            && col < rect.x.saturating_add(rect.width)
            && row >= rect.y
            && row < rect.y.saturating_add(rect.height)
    }

    fn compute_hovered_row(&self) -> Option<usize> {
        let rect = self.layout.menu_rect?;
        let (col, row) = self.layout.mouse_pos;

        if col < rect.x.saturating_add(1)
            || col >= rect.x.saturating_add(rect.width).saturating_sub(1)
            || row < rect.y
        {
            return None;
        }

        let items = self.items_len();
        if items == 0 {
            return None;
        }

        let hovered = row.saturating_sub(rect.y) as usize;
        if hovered < items { Some(hovered) } else { None }
    }

    #[expect(clippy::cast_possible_wrap)]
    fn move_selection(&mut self, delta: isize) {
        let len = self.items_len();
        if len == 0 {
            return;
        }
        let cur = self.nav.selected as isize + delta;
        let next = cur.rem_euclid(len as isize) as usize;
        self.nav.selected = next;
        self.list_state.select(Some(next));
    }

    fn activate(&mut self) {
        if self.cmd.status == RunStatus::Running {
            return;
        }

        match self.nav.page {
            Page::Main => {
                let Some(cat) = CATEGORIES.get(self.nav.selected) else { return };
                if cat.actions.is_empty() {
                    return;
                }
                self.nav.main_selected = self.nav.selected;
                self.nav.page = Page::Category(self.nav.selected);
                self.nav.selected = 0;
                self.list_state.select(Some(0));
            }
            Page::Category(i) => {
                if let Some(action) = CATEGORIES.get(i).and_then(|c| c.action_at(self.nav.selected))
                {
                    if action.needs_input() {
                        let step = match action {
                            MenuAction::PkgInstall
                            | MenuAction::PkgDelete
                            | MenuAction::PkgEnable => InputStep::ModuleId,
                            MenuAction::Protocol => InputStep::ProtocolUri,
                            _ => unreachable!(),
                        };
                        self.input = Some(InputState { action, buffer: String::new(), step });
                    } else {
                        self.run_action(action);
                    }
                }
            }
        }
    }

    fn go_back(&mut self) {
        if let Page::Category(_) = self.nav.page {
            self.nav.page = Page::Main;
            self.nav.selected = self.nav.main_selected;
            self.list_state.select(Some(self.nav.main_selected));
        }
    }

    fn run_action(&mut self, action: MenuAction) {
        let label = action.label();
        self.run_command(action.to_command(), &label);
        self.cmd.current = Some(action);
    }

    fn run_command(&mut self, cmd: Command, label: &str) {
        self.cmd.current = None;
        self.cmd.status = RunStatus::Running;
        self.cmd.last_started_at = Some(Instant::now());
        self.logs.push(format!(">>> {label}"));
        self.frame_requester.schedule();

        let ctx = self.ctx.clone();
        let tx = self.tx.clone();
        let fr = self.frame_requester.clone();
        if let Err(e) = std::thread::Builder::new().name("cmd-runner".into()).spawn(move || {
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                spicetify::commands::dispatch(&cmd, &ctx)
            }));
            match result {
                Ok(Ok(())) => {
                    let _ = tx.send(TuiEvent::CommandFinished { success: true });
                    fr.schedule();
                }
                Ok(Err(e)) => {
                    let _ = tx.send(TuiEvent::Log(format!("ERROR {e}")));
                    let _ = tx.send(TuiEvent::CommandFinished { success: false });
                    fr.schedule();
                }
                Err(panic) => {
                    let msg = if let Some(s) = panic.downcast_ref::<&str>() {
                        (*s).to_string()
                    } else if let Some(s) = panic.downcast_ref::<String>() {
                        s.clone()
                    } else {
                        "command panicked".to_string()
                    };
                    let _ = tx.send(TuiEvent::Log(format!("PANIC {msg}")));
                    let _ = tx.send(TuiEvent::CommandFinished { success: false });
                    fr.schedule();
                }
            }
        }) {
            tracing::error!("failed to spawn command thread: {e}");
            self.cmd.status = RunStatus::Error;
        }
    }

    fn drain_events(&mut self) -> bool {
        let mut drained = false;
        while let Ok(event) = self.rx.try_recv() {
            drained = true;
            match event {
                TuiEvent::Log(line) => self.logs.push(line),
                TuiEvent::CommandFinished { success } => {
                    self.cmd.status = if success { RunStatus::Ok } else { RunStatus::Error };
                    self.cmd.current = None;
                    self.cmd.last_started_at = None;
                }
            }
        }
        drained
    }
}
