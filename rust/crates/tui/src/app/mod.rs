mod input;

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use anyhow::Result;
use crossterm::event::Event;
use ratatui::Terminal;
use ratatui::backend::Backend;
use ratatui::layout::Rect;
use spicetify::commands::{Command, SyncTarget};
use spicetify::context::AppContext;
use spicetify::logging::{LogLine, TuiEvent, TuiEventSender};
use spicetify::{daemon, fl, hooks};
use tokio::sync::broadcast;
use tokio_stream::StreamExt;
use tracing::Level;

use crate::components::header::Header;
use crate::components::hook_selector::HookSelector;
use crate::components::log_viewer::LogViewer;
use crate::components::menu_list::{ActivateResult, MenuAction, MenuList};
use crate::frame_scheduler::FrameRequester;
use crate::render;

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
    pub(crate) fn new() -> Self {
        Self { index: None, source: InputSource::Keyboard }
    }

    pub(crate) fn on_keyboard(&mut self) {
        self.source = InputSource::Keyboard;
        self.index = None;
    }

    pub(crate) fn on_mouse_move(&mut self, idx: Option<usize>) {
        self.source = InputSource::Mouse;
        self.index = idx;
    }

    #[must_use]
    pub(crate) fn is_mouse_active(&self) -> bool {
        self.source == InputSource::Mouse
    }
}

#[derive(Debug, Clone, Copy)]
pub(crate) enum Action {
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
    ScrollLogUp,
    ScrollLogDown,
    ScrollMenuUp,
    ScrollMenuDown,
    ClearLog,
}

#[derive(Debug)]
pub(crate) struct CommandState {
    pub(crate) current: Option<MenuAction>,
    pub(crate) status: RunStatus,
    pub(crate) last_started_at: Option<Instant>,
}

#[derive(Debug)]
pub(crate) enum InputStep {
    ModuleId,
    ModuleUrl(String),
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
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct LayoutState {
    pub(crate) menu_rect: Option<Rect>,
    pub(crate) body_rect: Option<Rect>,
    pub(crate) log_rect: Option<Rect>,
    pub(crate) clear_rect: Option<Rect>,
    pub(crate) back_rect: Option<Rect>,
    pub(crate) dialog_rect: Option<Rect>,
    pub(crate) mouse_pos: (u16, u16),
}

#[derive(Debug)]
#[expect(clippy::struct_excessive_bools, reason = "flags represent orthogonal UI state")]
pub struct TuiApp {
    pub ctx: AppContext,
    should_quit: bool,

    pub(crate) menu: MenuList,
    pub(crate) log_viewer: LogViewer,
    pub(crate) header: Header,
    pub(crate) confirm_quit_open: bool,
    pub(crate) confirm_quit_yes: bool,
    pub(crate) cmd: CommandState,
    pub(crate) input: Option<InputState>,
    pub(crate) hook_selector: Option<HookSelector>,

    pub daemon_running: bool,
    pub daemon_installed: bool,

    pub(crate) layout: LayoutState,

    pub tx: TuiEventSender,
    rx: tokio::sync::mpsc::UnboundedReceiver<TuiEvent>,
    command_handle: Option<tokio::task::JoinHandle<()>>,

    frame_requester: FrameRequester,
    draw_tx: broadcast::Sender<()>,

    anim_tick: Instant,
}

impl TuiApp {
    pub(crate) fn new(
        ctx: AppContext,
        tx: TuiEventSender,
        rx: tokio::sync::mpsc::UnboundedReceiver<TuiEvent>,
        frame_requester: FrameRequester,
        draw_tx: broadcast::Sender<()>,
    ) -> Self {
        let now = Instant::now();
        let daemon_running = daemon::is_daemon_running();

        Self {
            ctx,
            should_quit: false,
            menu: MenuList::new(),
            log_viewer: LogViewer::new(400),
            header: Header::new(daemon_running),
            confirm_quit_open: false,
            confirm_quit_yes: true,
            cmd: CommandState { current: None, status: RunStatus::Idle, last_started_at: None },
            input: None,
            hook_selector: None,
            daemon_running,
            daemon_installed: daemon::DaemonManager::create().is_installed(),
            layout: LayoutState {
                menu_rect: None,
                body_rect: None,
                log_rect: None,
                clear_rect: None,
                back_rect: None,
                dialog_rect: None,
                mouse_pos: (0, 0),
            },
            tx,
            rx,
            command_handle: None,
            frame_requester,
            draw_tx,
            anim_tick: now,
        }
    }

    pub async fn run_async<B: Backend>(&mut self, terminal: &mut Terminal<B>) -> Result<()>
    where
        <B as Backend>::Error: std::fmt::Debug + Send + Sync + 'static,
    {
        let daemon_running = Arc::new(AtomicBool::new(self.daemon_running));
        let daemon_installed = Arc::new(AtomicBool::new(self.daemon_installed));

        let mut draw_rx = self.draw_tx.subscribe();

        spawn_daemon_poller(
            daemon_running.clone(),
            daemon_installed.clone(),
            self.frame_requester.clone(),
        );

        let mut events = crossterm::event::EventStream::new();
        let mut needs_draw = true;

        loop {
            if self.should_quit {
                return Ok(());
            }

            if needs_draw {
                self.render_frame(terminal)?;
                needs_draw = false;
            }

            tokio::select! {
                event = events.next() => {
                    if self.handle_terminal_event(event) {
                        needs_draw = true;
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
                Some(tui_event) = self.rx.recv() => {
                    self.process_tui_event(tui_event);
                    while let Ok(extra) = self.rx.try_recv() {
                        self.process_tui_event(extra);
                    }
                    needs_draw = true;
                }
            }

            if self.reconcile_daemon_state(&daemon_running, &daemon_installed) {
                needs_draw = true;
            }
            if self.tick_anim() {
                needs_draw = true;
            }
        }

        Ok(())
    }

    fn render_frame<B: Backend>(&mut self, terminal: &mut Terminal<B>) -> Result<()>
    where
        <B as Backend>::Error: std::fmt::Debug + Send + Sync + 'static,
    {
        terminal.draw(|frame| render::draw(frame, self)).map(|_| ())?;
        if self.cmd.status == RunStatus::Running {
            self.frame_requester.schedule_in(Duration::from_millis(80));
        }
        Ok(())
    }

    #[expect(clippy::needless_pass_by_value, reason = "consumes the inner Event via match")]
    fn handle_terminal_event(
        &mut self,
        event: Option<std::result::Result<Event, std::io::Error>>,
    ) -> bool {
        match event {
            Some(Ok(Event::Key(key))) => {
                self.handle_key(key);
                true
            }
            Some(Ok(Event::Mouse(mouse))) => {
                self.handle_mouse(mouse);
                true
            }
            _ => false,
        }
    }

    fn reconcile_daemon_state(&mut self, running: &AtomicBool, installed: &AtomicBool) -> bool {
        let r = running.load(Ordering::Acquire);
        let i = installed.load(Ordering::Acquire);
        if r != self.daemon_running || i != self.daemon_installed {
            self.daemon_running = r;
            self.daemon_installed = i;
            self.header.daemon_running = r;
            return true;
        }
        false
    }

    fn tick_anim(&mut self) -> bool {
        let now = Instant::now();
        if self.anim_tick.elapsed() >= Duration::from_millis(80) {
            self.anim_tick = now;
            self.header.tick_spinner();
            return true;
        }
        false
    }

    pub(crate) fn dispatch(&mut self, action: Action) {
        match action {
            Action::MoveUp => self.navigate_menu(-1),
            Action::MoveDown => self.navigate_menu(1),
            Action::MoveHome => self.navigate_menu_home(),
            Action::MoveEnd => self.navigate_menu_end(),
            Action::Select => self.select_menu_item(),
            Action::Back => self.menu.go_back(),
            Action::OpenQuitDialog => {
                self.confirm_quit_open = true;
                self.confirm_quit_yes = true;
            }
            Action::ConfirmQuit => self.should_quit = true,
            Action::CloseDialog => self.confirm_quit_open = false,
            Action::ToggleDialog => {
                self.confirm_quit_yes = !self.confirm_quit_yes;
            }
            Action::CancelInput => self.input = None,
            Action::SelectMenu(idx) => {
                self.menu.hover.on_keyboard();
                self.menu.select(idx);
                let visible = self.menu_visible_rows();
                self.menu.ensure_visible(visible);
                if self.cmd.status != RunStatus::Running
                    && let Some(result) = self.menu.activate()
                {
                    self.handle_activate(result);
                }
            }
            Action::ClearLog => self.log_viewer.clear(),
            Action::ScrollLogUp => self.log_viewer.scroll_up(),
            Action::ScrollLogDown => self.log_viewer.scroll_down(),
            Action::ScrollMenuUp => {
                let visible = self.menu_visible_rows();
                self.menu.scroll_up(visible);
            }
            Action::ScrollMenuDown => {
                let visible = self.menu_visible_rows();
                self.menu.scroll_down(visible);
            }
        }
    }

    fn navigate_menu(&mut self, delta: isize) {
        self.menu.hover.on_keyboard();
        self.menu.move_selection(delta);
        let visible = self.menu_visible_rows();
        self.menu.ensure_visible(visible);
    }

    fn navigate_menu_home(&mut self) {
        self.menu.hover.on_keyboard();
        self.menu.select(0);
        self.menu.scroll = 0;
    }

    fn navigate_menu_end(&mut self) {
        let last = self.menu.item_count().saturating_sub(1);
        self.menu.hover.on_keyboard();
        self.menu.select(last);
        let visible = self.menu_visible_rows();
        self.menu.ensure_visible(visible);
    }

    fn select_menu_item(&mut self) {
        if self.cmd.status == RunStatus::Running {
            return;
        }
        self.menu.hover.on_keyboard();
        if let Some(result) = self.menu.activate() {
            self.handle_activate(result);
        }
    }

    fn handle_activate(&mut self, result: ActivateResult) {
        match result {
            ActivateResult::EnterCategory => {}
            ActivateResult::RunAction(action) if action.needs_input() => {
                self.input =
                    Some(InputState { action, buffer: String::new(), step: InputStep::ModuleId });
            }
            ActivateResult::RunAction(MenuAction::Sync) => {
                self.start_hook_manifest_fetch();
            }
            ActivateResult::RunAction(action) => self.run_action(action),
        }
    }

    fn menu_visible_rows(&self) -> usize {
        self.layout.menu_rect.map_or(1, |r| r.height.max(1) as usize)
    }

    fn run_action(&mut self, action: MenuAction) {
        self.run_command(action.into_command(), &action.label());
        self.cmd.current = Some(action);
    }

    fn run_command(&mut self, cmd: Command, label: &str) {
        if let Some(prev) = self.command_handle.take() {
            prev.abort();
        }

        self.cmd.status = RunStatus::Running;
        self.cmd.last_started_at = Some(Instant::now());
        self.log_viewer.push(format!(">>> {label}"));
        self.frame_requester.schedule();

        let ctx = self.ctx.clone();
        let tx = self.tx.clone();
        let fr = self.frame_requester.clone();
        self.command_handle = Some(tokio::task::spawn_blocking(move || {
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                spicetify::commands::dispatch(&cmd, &ctx)
            }));
            match result {
                Ok(Ok(())) => {
                    if tx.send(TuiEvent::CommandFinished { success: true }).is_err() {
                        return;
                    }
                    fr.schedule();
                }
                Ok(Err(e)) => {
                    if tx
                        .send(TuiEvent::Log(LogLine {
                            level: Level::ERROR,
                            message: format!("{e}"),
                        }))
                        .is_err()
                    {
                        return;
                    }
                    if tx.send(TuiEvent::CommandFinished { success: false }).is_err() {
                        return;
                    }
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
                    if tx
                        .send(TuiEvent::Log(LogLine {
                            level: Level::ERROR,
                            message: format!("PANIC {msg}"),
                        }))
                        .is_err()
                    {
                        return;
                    }
                    if tx.send(TuiEvent::CommandFinished { success: false }).is_err() {
                        return;
                    }
                    fr.schedule();
                }
            }
        }));
    }

    fn start_hook_manifest_fetch(&mut self) {
        self.log_viewer.push(">>> Fetching available hook versions...".to_string());
        self.frame_requester.schedule();

        let tx = self.tx.clone();

        drop(tokio::task::spawn(async move {
            match hooks::manifest::fetch_hook_sets_async().await {
                Ok(sets) => {
                    if let Err(e) = tx.send(TuiEvent::HookManifestFetched { sets }) {
                        tracing::warn!(error = %e, "hook manifest receiver dropped");
                    }
                }
                Err(e) => {
                    if let Err(e) = tx.send(TuiEvent::Log(LogLine {
                        level: Level::ERROR,
                        message: format!("failed to fetch hook sets: {e}"),
                    })) {
                        tracing::warn!(error = %e, "hook manifest error receiver dropped");
                    }
                }
            }
        }));
    }

    fn reconcile_hook_manifest(&mut self, sets: Vec<hooks::HookSet>) {
        if sets.is_empty() {
            self.log_viewer
                .push(LogLine { level: Level::ERROR, message: fl!("hooks-manifest-empty") });
            return;
        }
        self.hook_selector = Some(HookSelector::new(sets));
        self.frame_requester.schedule();
    }

    fn process_tui_event(&mut self, event: TuiEvent) {
        match event {
            TuiEvent::Log(line) => {
                self.log_viewer.push(line);
            }
            TuiEvent::CommandFinished { success } => {
                self.cmd.status = if success { RunStatus::Ok } else { RunStatus::Error };
                self.cmd.current = None;
                self.cmd.last_started_at = None;
                self.command_handle = None;
            }
            TuiEvent::HookManifestFetched { sets } => {
                self.reconcile_hook_manifest(sets);
            }
            TuiEvent::HookSetsResolved { resolved } => {
                if let Some(ref version) = resolved.spotify_version {
                    self.log_viewer.push(format!("detected Spotify {version}"));
                }
                if resolved.matching.is_empty() {
                    let version = resolved
                        .spotify_version
                        .map_or_else(|| "unknown".to_string(), |v| v.to_string());
                    self.log_viewer.push(format!(
                        "no hook set supports Spotify {version}. Available sets require different \
                         Spotify versions",
                    ));
                    return;
                }
                let set = resolved.best_match().expect("non-empty after empty check");
                let label = set.display_label();
                self.log_viewer.push(format!("using hook set v{} ({})", set.hooks_version, label));
                self.run_command(Command::Sync(SyncTarget::Url(set.download_url)), &label);
                self.cmd.current = Some(MenuAction::Sync);
            }
        }
    }
}

fn spawn_daemon_poller(
    daemon_running: Arc<AtomicBool>,
    daemon_installed: Arc<AtomicBool>,
    frame_requester: FrameRequester,
) {
    let _watcher = tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;
            let prev_running = daemon_running.load(Ordering::Acquire);
            let prev_installed = daemon_installed.load(Ordering::Acquire);
            if let Ok(running) = tokio::task::spawn_blocking(daemon::is_daemon_running).await {
                if running != prev_running {
                    frame_requester.schedule();
                }
                daemon_running.store(running, Ordering::Release);
            }
            if let Ok(installed) =
                tokio::task::spawn_blocking(|| daemon::DaemonManager::create().is_installed()).await
            {
                if installed != prev_installed {
                    frame_requester.schedule();
                }
                daemon_installed.store(installed, Ordering::Release);
            }
        }
    });
}
