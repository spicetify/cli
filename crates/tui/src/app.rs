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
use spicetify::context::AppContext;
use spicetify::logging::{TuiEvent, TuiEventSender};
use tokio::sync::broadcast;

use crate::frame_scheduler::FrameRequester;
use crate::log_buffer::LogBuffer;
use crate::menu::{CATEGORIES, MenuAction};
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

#[derive(Debug)]
pub struct TuiApp {
    pub ctx: AppContext,
    pub should_quit: Arc<AtomicBool>,

    pub page: Page,
    pub selected: usize,
    main_selected: usize,

    pub exit_armed_at: Option<Instant>,

    pub daemon_running: bool,
    pub daemon_installed: bool,
    last_daemon_check: Instant,

    pub current: Option<MenuAction>,
    pub status: RunStatus,
    pub last_result: Option<RunStatus>,
    pub last_started_at: Option<Instant>,

    pub spinner_frame: usize,
    pub progress_pct: f32,
    progress_dir: f32,
    last_spinner_tick: Instant,
    last_progress_tick: Instant,

    pub logs: LogBuffer,

    pub menu_rect: Option<Rect>,
    pub body_rect: Option<Rect>,
    pub hovered_row: Option<usize>,
    mouse_pos: (u16, u16),

    pub tx: TuiEventSender,
    rx: Receiver<TuiEvent>,

    pub list_state: ListState,

    frame_req: FrameRequester,
    draw_rx: broadcast::Receiver<()>,
}

impl TuiApp {
    #[must_use]
    pub(crate) fn new(
        ctx: AppContext,
        tx: TuiEventSender,
        rx: Receiver<TuiEvent>,
        frame_req: FrameRequester,
        draw_rx: broadcast::Receiver<()>,
    ) -> Self {
        let now = Instant::now();
        let mut list = ListState::default();
        list.select(Some(0));

        Self {
            ctx,
            should_quit: Arc::new(AtomicBool::new(false)),
            page: Page::Main,
            selected: 0,
            main_selected: 0,
            exit_armed_at: None,
            daemon_running: false,
            daemon_installed: false,
            last_daemon_check: now,
            current: None,
            status: RunStatus::Idle,
            last_result: None,
            last_started_at: None,
            spinner_frame: 0,
            progress_pct: 0.0,
            progress_dir: 1.0,
            last_spinner_tick: now,
            last_progress_tick: now,
            logs: LogBuffer::new(400),
            menu_rect: None,
            body_rect: None,
            hovered_row: None,
            mouse_pos: (0, 0),
            tx,
            rx,
            list_state: list,
            frame_req,
            draw_rx,
        }
    }

    #[must_use]
    pub fn menu_labels(&self) -> Vec<String> {
        match self.page {
            Page::Main => CATEGORIES.iter().map(|c| c.id.label()).collect(),
            Page::Category(i) => CATEGORIES
                .get(i)
                .map(|c| c.actions.iter().map(|a| a.label()).collect())
                .unwrap_or_default(),
        }
    }

    #[must_use]
    pub fn details_lines(&self) -> Vec<String> {
        match self.page {
            Page::Main => CATEGORIES
                .get(self.selected)
                .map_or_else(|| vec![String::new()], |c| vec![c.id.label(), c.id.description()]),
            Page::Category(i) => CATEGORIES
                .get(i)
                .and_then(|c| c.actions.get(self.selected).copied())
                .map_or_else(|| vec![String::new()], |a| vec![a.label(), a.description()]),
        }
    }

    #[must_use]
    pub fn is_navigable(&self) -> bool {
        matches!(self.page, Page::Main)
    }

    pub async fn run_async<B: Backend>(&mut self, terminal: &mut Terminal<B>) -> Result<()>
    where
        <B as Backend>::Error: std::fmt::Debug + Send + Sync + 'static,
    {
        let mut events = crossterm::event::EventStream::new();
        let mut tick = tokio::time::interval(Duration::from_millis(50));
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        let mut pending_draw = true;

        loop {
            if self.should_quit.load(Ordering::Acquire) {
                return Ok(());
            }

            tokio::select! {
                event = events.next() => {
                    match event {
                        Some(Ok(Event::Key(key))) => self.handle_key(key),
                        Some(Ok(Event::Mouse(mouse))) => self.handle_mouse(mouse),
                        _ => {}
                    }
                    self.frame_req.schedule();
                }
                _ = self.draw_rx.recv() => {
                    pending_draw = true;
                }
                _ = tick.tick() => {}
            }

            if self.refresh_daemon(Duration::from_secs(1)) {
                self.frame_req.schedule();
            }
            if self.tick_animation() {
                self.frame_req.schedule();
            }
            if self.drain_events() {
                self.frame_req.schedule();
            }

            if pending_draw {
                terminal.draw(|frame| render::draw(frame, self)).map(|_| ())?;
                pending_draw = false;
            }
        }
    }

    fn refresh_daemon(&mut self, interval: Duration) -> bool {
        if self.last_daemon_check.elapsed() < interval {
            return false;
        }
        let running = spicetify::daemon::is_daemon_running();
        let installed = spicetify::daemon::manager::create().is_installed();
        self.last_daemon_check = Instant::now();
        if running != self.daemon_running || installed != self.daemon_installed {
            self.daemon_running = running;
            self.daemon_installed = installed;
            return true;
        }
        false
    }

    fn tick_animation(&mut self) -> bool {
        let now = Instant::now();
        let mut advanced = false;

        if self.last_spinner_tick.elapsed() >= Duration::from_millis(80) {
            self.spinner_frame = (self.spinner_frame + 1) % SPINNER_FRAMES.len();
            self.last_spinner_tick = now;
            advanced = true;
        }

        // fake progress bar doesnt work
        // tried to copy bubbletea
        if self.status == RunStatus::Running
            && self.last_progress_tick.elapsed() >= Duration::from_millis(30)
        {
            self.progress_pct += self.progress_dir * 0.008;
            if self.progress_pct >= 1.0 {
                self.progress_pct = 1.0;
                self.progress_dir = -1.0;
            } else if self.progress_pct <= 0.0 {
                self.progress_pct = 0.0;
                self.progress_dir = 1.0;
            }
            self.last_progress_tick = now;
            advanced = true;
        }

        advanced
    }

    fn handle_key(&mut self, key: crossterm::event::KeyEvent) {
        if key.kind != KeyEventKind::Press {
            return;
        }

        if !(key.modifiers.contains(KeyModifiers::CONTROL) && key.code == KeyCode::Char('c')) {
            self.exit_armed_at = None;
        }

        let is_ctrl = key.modifiers.contains(KeyModifiers::CONTROL);
        match key.code {
            KeyCode::Char('c') if is_ctrl => {
                if self.exit_armed_at.is_some() {
                    self.should_quit.store(true, Ordering::Release);
                } else {
                    self.exit_armed_at = Some(Instant::now());
                }
            }
            KeyCode::Char('q') => {
                if self.exit_armed_at.is_some() {
                    self.should_quit.store(true, Ordering::Release);
                } else {
                    self.exit_armed_at = Some(Instant::now());
                }
            }
            KeyCode::Up | KeyCode::Char('k') => self.move_selection(-1),
            KeyCode::Down | KeyCode::Char('j') => self.move_selection(1),
            KeyCode::Home => {
                self.selected = 0;
                self.list_state.select(Some(0));
            }
            KeyCode::End => {
                let last = self.items_len().saturating_sub(1);
                self.selected = last;
                self.list_state.select(Some(last));
            }
            KeyCode::Right | KeyCode::Char('l') | KeyCode::Enter => self.activate(),
            KeyCode::Left | KeyCode::Char('h') | KeyCode::Esc => self.go_back(),
            _ => {}
        }
    }

    fn handle_mouse(&mut self, mouse: crossterm::event::MouseEvent) {
        match mouse.kind {
            MouseEventKind::Down(MouseButton::Left) => {
                if self.click_in_menu(mouse.column, mouse.row) {
                    let rect = self.menu_rect.expect("menu_rect set when click_in_menu true");
                    let row = (mouse.row.saturating_sub(rect.y.saturating_add(1))) as usize;
                    if row < self.items_len() {
                        self.selected = row;
                        self.list_state.select(Some(row));
                        self.activate();
                    }
                } else if self.click_in_body(mouse.column, mouse.row)
                    && matches!(self.page, Page::Category(_))
                {
                    self.go_back();
                }
            }
            MouseEventKind::Down(MouseButton::Right) => {
                self.go_back();
            }
            MouseEventKind::Moved => {
                self.mouse_pos = (mouse.column, mouse.row);
                self.hovered_row = self.compute_hovered_row();
            }
            _ => {}
        }
    }

    fn click_in_menu(&self, col: u16, row: u16) -> bool {
        let Some(rect) = self.menu_rect else { return false };
        col >= rect.x
            && col < rect.x.saturating_add(rect.width)
            && row >= rect.y
            && row < rect.y.saturating_add(rect.height)
    }

    fn click_in_body(&self, col: u16, row: u16) -> bool {
        let Some(rect) = self.body_rect else { return false };
        col >= rect.x
            && col < rect.x.saturating_add(rect.width)
            && row >= rect.y
            && row < rect.y.saturating_add(rect.height)
    }

    fn compute_hovered_row(&self) -> Option<usize> {
        let rect = self.menu_rect?;
        let (col, row) = self.mouse_pos;

        if col < rect.x.saturating_add(1)
            || col >= rect.x.saturating_add(rect.width).saturating_sub(1)
            || row <= rect.y
        {
            return None;
        }

        let items = self.items_len();
        if items == 0 {
            return None;
        }

        let hovered = (row.saturating_sub(rect.y.saturating_add(1))) as usize;
        if hovered < items { Some(hovered) } else { None }
    }

    fn items_len(&self) -> usize {
        match self.page {
            Page::Main => CATEGORIES.len(),
            Page::Category(i) => CATEGORIES.get(i).map_or(0, |c| c.actions.len()),
        }
    }

    #[expect(clippy::cast_possible_wrap)]
    fn move_selection(&mut self, delta: isize) {
        let len = self.items_len();
        if len == 0 {
            return;
        }
        let cur = self.selected as isize + delta;
        let next = cur.rem_euclid(len as isize) as usize;
        self.selected = next;
        self.list_state.select(Some(next));
    }

    fn activate(&mut self) {
        if self.status == RunStatus::Running {
            return;
        }

        match self.page {
            Page::Main => {
                let Some(cat) = CATEGORIES.get(self.selected) else { return };
                if cat.actions.is_empty() {
                    return;
                }
                self.main_selected = self.selected;
                self.page = Page::Category(self.selected);
                self.selected = 0;
                self.list_state.select(Some(0));
            }
            Page::Category(i) => {
                if let Some(action) =
                    CATEGORIES.get(i).and_then(|c| c.actions.get(self.selected).copied())
                {
                    self.run_action(action);
                }
            }
        }
    }

    fn go_back(&mut self) {
        if let Page::Category(_) = self.page {
            self.page = Page::Main;
            self.selected = self.main_selected;
            self.list_state.select(Some(self.main_selected));
        }
    }

    fn run_action(&mut self, action: MenuAction) {
        self.current = Some(action);
        self.status = RunStatus::Running;
        self.last_started_at = Some(Instant::now());
        self.logs.push(format!(">>> {}", action.label()));

        let ctx = self.ctx.clone();
        let tx = self.tx.clone();
        let _ = std::thread::spawn(move || {
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                spicetify::commands::dispatch(&action.to_command(), &ctx)
            }));
            match result {
                Ok(Ok(())) => {
                    let _ = tx.send(TuiEvent::Log("OK".to_string()));
                    let _ = tx.send(TuiEvent::CommandFinished { success: true });
                }
                Ok(Err(e)) => {
                    let _ = tx.send(TuiEvent::Log(format!("ERROR {e}")));
                    let _ = tx.send(TuiEvent::CommandFinished { success: false });
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
                }
            }
        });
    }

    fn drain_events(&mut self) -> bool {
        let mut drained = false;
        while let Ok(event) = self.rx.try_recv() {
            drained = true;
            match event {
                TuiEvent::Log(line) => self.logs.push(line),
                TuiEvent::CommandFinished { success } => {
                    self.status = if success { RunStatus::Ok } else { RunStatus::Error };
                    self.last_result = Some(self.status);
                    self.current = None;
                    self.last_started_at = None;
                }
            }
        }
        drained
    }
}
