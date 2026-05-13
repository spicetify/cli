use std::{
    io, sync::{
        Arc, atomic::{AtomicBool, Ordering}, mpsc::{self, Receiver, RecvTimeoutError, Sender}
    }, time::Instant
};

use anyhow::Result;
use ratatui::{Terminal, backend::CrosstermBackend};
use spicetify::{config::AppContext, i18n, logging};

use super::{
    events::{self, Action, UiEvent}, render, theme
};

pub const FRAME_INTERVAL: std::time::Duration = std::time::Duration::from_millis(33);

pub struct TuiApp {
    pub ctx: AppContext,
    pub selected: usize,
    pub running: bool,
    pub exit_armed: bool,
    pub current_action: Option<Action>,
    pub last_result: Option<bool>,
    pub progress: f64,
    pub progress_target: f64,
    pub link_steps: usize,
    pub phase: String,
    pub command_start: Option<Instant>,
    pub spinner: usize,
    pub last_spinner_tick: Instant,
    pub buddy_frame: usize,
    pub last_buddy_tick: Instant,
    pub daemon_running: bool,
    pub last_daemon_check: Instant,
    pub logs: logging::LogBuffer,
    pub tx: Sender<UiEvent>,
    pub rx: Receiver<UiEvent>,
}

impl TuiApp {
    pub fn new(ctx: &AppContext) -> Self {
        let (tx, rx) = mpsc::channel();
        Self {
            ctx: ctx.clone(),
            selected: Action::ALL
                .iter()
                .position(|a| matches!(a, Action::Config))
                .unwrap_or(0),
            running: false,
            exit_armed: false,
            current_action: None,
            last_result: None,
            progress: 0.0,
            progress_target: 0.0,
            link_steps: 0,
            phase: i18n::lookup("tui_pick_command"),
            command_start: None,
            spinner: 0,
            last_spinner_tick: Instant::now(),
            buddy_frame: 0,
            last_buddy_tick: Instant::now(),
            daemon_running: false,
            last_daemon_check: Instant::now(),
            logs: logging::LogBuffer::new(400),
            tx,
            rx,
        }
    }

    pub fn run(&mut self, terminal: &mut Terminal<CrosstermBackend<io::Stdout>>) -> Result<()> {
        events::drain_pending_input()?;
        self.refresh_daemon(true);

        let stop = Arc::new(AtomicBool::new(false));
        let input_handle = events::spawn_input_worker(self.tx.clone(), Arc::clone(&stop));

        let result = self.event_loop(terminal);

        stop.store(true, Ordering::Relaxed);
        let _ = input_handle.join();
        result
    }

    fn event_loop(&mut self, terminal: &mut Terminal<CrosstermBackend<io::Stdout>>) -> Result<()> {
        render::draw(self, terminal)?;
        loop {
            match self.rx.recv_timeout(FRAME_INTERVAL) {
                Ok(event) => {
                    if self.handle_event(event) {
                        return Ok(());
                    }
                }
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => return Ok(()),
            }
            self.tick();
            render::draw(self, terminal)?;
        }
    }

    fn handle_event(&mut self, event: UiEvent) -> bool {
        match event {
            UiEvent::Key(key) => events::handle_key(self, key),
            UiEvent::CommandLog(line) => {
                self.advance_progress(&line);
                self.logs.push(line);
                false
            }
            UiEvent::CommandFinished { success } => {
                self.running = false;
                self.last_result = Some(success);
                self.progress_target = if success { 1.0 } else { 0.95 };
                self.phase = if success {
                    i18n::lookup("tui_completed_success")
                } else {
                    i18n::lookup("tui_completed_errors")
                };
                false
            }
            UiEvent::InputWorkerError => true,
        }
    }

    fn tick(&mut self) {
        self.refresh_daemon(false);
        self.animate_buddy();
        self.animate_spinner();
        self.animate_progress();
    }

    fn animate_buddy(&mut self) {
        if self.last_buddy_tick.elapsed() >= events::BUDDY_INTERVAL {
            self.buddy_frame = (self.buddy_frame + 1) % theme::BUDDY_POSES.len();
            self.last_buddy_tick = Instant::now();
        }
    }

    fn animate_spinner(&mut self) {
        if self.running && self.last_spinner_tick.elapsed() >= events::SPINNER_INTERVAL {
            self.spinner = (self.spinner + 1) % theme::SPINNER_FRAMES.len();
            self.last_spinner_tick = Instant::now();
        }
    }

    fn animate_progress(&mut self) {
        if self.running
            && let Some(start) = self.command_start
        {
            let drift = (0.08 + start.elapsed().as_secs_f64() * 0.04).min(0.88);
            self.progress_target = self.progress_target.max(drift);
        }
        if self.progress_target > self.progress {
            let delta = self.progress_target - self.progress;
            let step = (delta * 0.22).max(0.004);
            self.progress = (self.progress + step).min(self.progress_target);
        }
        self.progress = self.progress.clamp(0.0, 1.0);
    }

    fn advance_progress(&mut self, line: &str) {
        let lower = line.to_ascii_lowercase();
        if lower.starts_with("error") || lower.starts_with("fatal") {
            self.phase = i18n::lookup("tui_error_phase");
            self.progress_target = self.progress_target.max(0.85);
            return;
        }

        self.phase = line
            .trim_start_matches("INFO ")
            .trim_start_matches("WARN ")
            .trim_start_matches("ERROR ")
            .chars()
            .take(72)
            .collect();

        if let Some(Action::Apply) = self.current_action {
            if lower.contains("extracting ") && lower.contains("xpui.spa") {
                self.progress_target = self.progress_target.max(0.22);
            } else if lower.contains("extracting xpui-modules") {
                self.progress_target = self.progress_target.max(0.44);
            } else if lower.contains("patching xpui/index.html") {
                self.progress_target = self.progress_target.max(0.62);
            } else if lower.contains("linking ") {
                self.link_steps = (self.link_steps + 1).min(3);
                self.progress_target = self
                    .progress_target
                    .max(0.68 + self.link_steps as f64 * 0.08);
            } else if lower.contains("patched spotify") {
                self.progress_target = self.progress_target.max(0.96);
            }
        } else if lower.starts_with("info") {
            self.progress_target = (self.progress_target + 0.16).min(0.9);
        } else if lower.starts_with("warn") {
            self.progress_target = (self.progress_target + 0.1).min(0.88);
        }
    }

    pub fn refresh_daemon(&mut self, force: bool) {
        if !force && self.last_daemon_check.elapsed() < events::DAEMON_CHECK_INTERVAL {
            return;
        }
        self.daemon_running = events::is_daemon_running();
        self.last_daemon_check = Instant::now();
    }
}
