use std::{
    net::{SocketAddr, TcpStream, ToSocketAddrs}, process::{Command, Stdio}, sync::{
        Arc, atomic::{AtomicBool, Ordering}, mpsc::{self, Sender}
    }, thread::{self, JoinHandle}, time::{Duration, Instant}
};

use anyhow::{Context, Result, anyhow};
use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};

use super::app::TuiApp;
use crate::{
    commands::{apply, config, daemon as daemon_cmd, dev, fix, sync, update}, logging
};

pub const INPUT_POLL: Duration = Duration::from_millis(50);
pub const SPINNER_INTERVAL: Duration = Duration::from_millis(110);
pub const BUDDY_INTERVAL: Duration = Duration::from_millis(220);
pub const DAEMON_CHECK_INTERVAL: Duration = Duration::from_secs(1);
pub const CONNECT_TIMEOUT: Duration = Duration::from_millis(120);
pub const DAEMON_ADDR: &str = "localhost:7967";

#[derive(Clone, Copy)]
pub enum Action {
    Apply,
    Fix,
    Dev,
    Sync,
    UpdateOn,
    UpdateOff,
    DaemonStart,
    DaemonStop,
    DaemonEnable,
    DaemonDisable,
    Config,
}

impl Action {
    pub const ALL: [Self; 11] = [
        Self::Apply,
        Self::Fix,
        Self::Dev,
        Self::Sync,
        Self::UpdateOn,
        Self::UpdateOff,
        Self::DaemonStart,
        Self::DaemonStop,
        Self::DaemonEnable,
        Self::DaemonDisable,
        Self::Config,
    ];

    pub fn label(self) -> &'static str {
        match self {
            Self::Apply => "apply",
            Self::Fix => "fix",
            Self::Dev => "dev",
            Self::Sync => "sync",
            Self::UpdateOn => "update on",
            Self::UpdateOff => "update off",
            Self::DaemonStart => "daemon",
            Self::DaemonStop => "daemon stop",
            Self::DaemonEnable => "daemon enable",
            Self::DaemonDisable => "daemon disable",
            Self::Config => "config",
        }
    }

    pub fn summary(self) -> &'static str {
        match self {
            Self::Apply => "Apply hooks/modules to Spotify",
            Self::Fix => "Restore Spotify to stock state",
            Self::Dev => "Enable app-developer mode",
            Self::Sync => "Sync hook files",
            Self::UpdateOn => "Allow native Spotify updates",
            Self::UpdateOff => "Block native Spotify updates",
            Self::DaemonStart => "Start background daemon runtime",
            Self::DaemonStop => "Stop running daemon runtime",
            Self::DaemonEnable => "Enable daemon in config",
            Self::DaemonDisable => "Disable daemon in config",
            Self::Config => "Print effective config values",
        }
    }
}

#[derive(Debug)]
pub enum UiEvent {
    Key(KeyEvent),
    CommandLog(String),
    CommandFinished { success: bool },
    InputWorkerError,
}

pub fn handle_key(app: &mut TuiApp, key: KeyEvent) -> bool {
    match key.code {
        KeyCode::Up => {
            if !app.running {
                app.selected = if app.selected == 0 {
                    Action::ALL.len() - 1
                } else {
                    app.selected - 1
                };
            }
            app.exit_armed = false;
            false
        }
        KeyCode::Down => {
            if !app.running {
                app.selected = (app.selected + 1) % Action::ALL.len();
            }
            app.exit_armed = false;
            false
        }
        KeyCode::Enter => {
            if !app.running {
                dispatch_action(app);
            }
            app.exit_armed = false;
            false
        }
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            if app.running {
                false
            } else if app.exit_armed {
                true
            } else {
                app.exit_armed = true;
                false
            }
        }
        _ => {
            app.exit_armed = false;
            false
        }
    }
}

fn dispatch_action(app: &mut TuiApp) {
    let action = Action::ALL[app.selected];

    if matches!(action, Action::DaemonStart | Action::DaemonStop) {
        return dispatch_daemon(app, action);
    }

    app.running = true;
    app.exit_armed = false;
    app.current_action = Some(action);
    app.last_result = None;
    app.progress = 0.0;
    app.progress_target = 0.07;
    app.link_steps = 0;
    app.phase = format!("Starting {}", action.label());
    app.command_start = Some(Instant::now());
    app.spinner = 0;
    app.last_spinner_tick = Instant::now();
    app.logs = logging::LogBuffer::new(400);

    let ctx = app.ctx.clone();
    let ui_tx = app.tx.clone();

    thread::spawn(move || {
        let (log_tx, log_rx) = mpsc::channel::<String>();
        let log_ui_tx = ui_tx.clone();

        let log_thread = thread::spawn(move || {
            while let Ok(line) = log_rx.recv() {
                let _ = log_ui_tx.send(UiEvent::CommandLog(line));
            }
        });

        logging::capture_begin(log_tx);

        let success = match execute_cli_command(action, &ctx) {
            Ok(()) => true,
            Err(err) => {
                let _ = ui_tx.send(UiEvent::CommandLog(format!("ERROR {err}")));
                false
            }
        };

        let _ = logging::capture_end();
        let _ = log_thread.join();
        let _ = ui_tx.send(UiEvent::CommandFinished { success });
    });
}

fn execute_cli_command(action: Action, ctx: &crate::config::AppContext) -> Result<()> {
    match action {
        Action::Apply => {
            apply::run(ctx)?;
            logging::info("Patched Spotify");
            crate::process::restart_if_running(ctx)
        }
        Action::Fix => {
            fix::run(ctx)?;
            logging::info("Restored Spotify to stock state");
            crate::process::restart_if_running(ctx)
        }
        Action::Dev => {
            dev::run(ctx)?;
            logging::info("Mode app-developer enabled");
            crate::process::restart_if_running(ctx)
        }
        Action::Sync => {
            sync::run(ctx)?;
            logging::info("Hooks updated successfully");
            Ok(())
        }
        Action::UpdateOn => {
            update::run(ctx, false)?;
            logging::info("Patched the executable successfully");
            Ok(())
        }
        Action::UpdateOff => {
            crate::process::stop(ctx)?;
            update::run(ctx, true)?;
            logging::info("Patched the executable successfully");
            Ok(())
        }
        Action::DaemonStart => daemon_cmd::start(ctx),
        Action::DaemonStop => match shutdown_daemon() {
            Ok(()) => {
                logging::info("Daemon has stopped");
                Ok(())
            }
            Err(e) => Err(e),
        },
        Action::DaemonEnable => {
            daemon_cmd::enable(ctx)?;
            logging::info("Daemon enabled in config");
            Ok(())
        }
        Action::DaemonDisable => {
            daemon_cmd::disable(ctx)?;
            logging::info("Daemon disabled in config");
            Ok(())
        }
        Action::Config => config::run(ctx),
    }
}

fn dispatch_daemon(app: &mut TuiApp, action: Action) {
    app.running = false;
    app.current_action = Some(action);
    app.command_start = Some(Instant::now());
    app.spinner = 0;
    app.last_spinner_tick = Instant::now();
    app.logs = logging::LogBuffer::new(400);

    match action {
        Action::DaemonStart => {
            app.refresh_daemon(true);
            if app.daemon_running {
                app.last_result = Some(true);
                app.progress = 1.0;
                app.progress_target = 1.0;
                app.phase = "Daemon is already active".into();
                app.logs.push("INFO Daemon already running".into());
            } else {
                match launch_daemon() {
                    Ok(()) => {
                        app.last_result = Some(true);
                        app.progress = 1.0;
                        app.progress_target = 1.0;
                        app.phase = "Daemon launched in background".into();
                        app.logs.push("INFO Started daemon process".into());
                        app.refresh_daemon(true);
                    }
                    Err(err) => {
                        app.last_result = Some(false);
                        app.progress = 0.0;
                        app.progress_target = 0.95;
                        app.phase = "Failed to launch daemon".into();
                        app.logs.push(format!("ERROR {err}"));
                    }
                }
            }
        }
        Action::DaemonStop => {
            if !app.daemon_running {
                app.last_result = Some(true);
                app.progress = 1.0;
                app.progress_target = 1.0;
                app.phase = "Daemon is already stopped".into();
                app.logs.push("INFO Daemon is not running".into());
            } else {
                match shutdown_daemon() {
                    Ok(()) => {
                        if wait_daemon_stop(Duration::from_secs(2)) {
                            app.last_result = Some(true);
                            app.progress = 1.0;
                            app.progress_target = 1.0;
                            app.phase = "Daemon stopped".into();
                            app.logs.push("INFO Daemon has stopped".into());
                        } else {
                            app.last_result = Some(false);
                            app.progress = 0.0;
                            app.progress_target = 0.95;
                            app.phase = "Shutdown sent but daemon still active".into();
                            app.logs.push(
                                "ERROR Daemon did not stop; older build may not support shutdown"
                                    .into(),
                            );
                        }
                        app.refresh_daemon(true);
                    }
                    Err(err) => {
                        app.last_result = Some(false);
                        app.progress = 0.0;
                        app.progress_target = 0.95;
                        app.phase = "Failed to stop daemon".into();
                        app.logs.push(format!("ERROR {err}"));
                    }
                }
            }
        }
        _ => {}
    }
}

pub fn launch_daemon() -> Result<()> {
    let exe = std::env::current_exe().context("unable to resolve executable")?;
    Command::new(exe)
        .arg("daemon")
        .arg("start")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .context("failed to spawn daemon process")?;
    Ok(())
}

pub fn shutdown_daemon() -> Result<()> {
    let client = reqwest::blocking::Client::builder()
        .timeout(CONNECT_TIMEOUT)
        .build()?;

    let mut seen = false;
    for addr in daemon_addresses() {
        let url = format!("http://{addr}/shutdown");
        if let Ok(resp) = client.post(&url).send() {
            if resp.status().is_success() {
                return Ok(());
            }
            if resp.status() == reqwest::StatusCode::NOT_FOUND
                || resp.status() == reqwest::StatusCode::METHOD_NOT_ALLOWED
            {
                seen = true;
            }
        }
    }
    if seen {
        Err(anyhow!("daemon does not support remote shutdown"))
    } else {
        Err(anyhow!("daemon is not running"))
    }
}

fn wait_daemon_stop(timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if !is_daemon_running() {
            return true;
        }
        thread::sleep(Duration::from_millis(120));
    }
    !is_daemon_running()
}

pub fn is_daemon_running() -> bool {
    daemon_addresses()
        .iter()
        .any(|addr| TcpStream::connect_timeout(addr, CONNECT_TIMEOUT).is_ok())
}

fn daemon_addresses() -> Vec<SocketAddr> {
    DAEMON_ADDR
        .to_socket_addrs()
        .map_or(Vec::new(), |a| a.collect())
}

pub fn spawn_input_worker(tx: Sender<UiEvent>, stop: Arc<AtomicBool>) -> JoinHandle<()> {
    thread::spawn(move || {
        loop {
            if stop.load(Ordering::Relaxed) {
                break;
            }
            match event::poll(INPUT_POLL) {
                Ok(true) => match event::read() {
                    Ok(Event::Key(key)) if key.kind == KeyEventKind::Press => {
                        let _ = tx.send(UiEvent::Key(key));
                    }
                    Err(_) => {
                        let _ = tx.send(UiEvent::InputWorkerError);
                        break;
                    }
                    _ => {}
                },
                Ok(false) => {}
                Err(_) => {
                    let _ = tx.send(UiEvent::InputWorkerError);
                    break;
                }
            }
        }
    })
}

pub fn drain_pending_input() -> Result<()> {
    while event::poll(Duration::from_millis(0))? {
        let _ = event::read()?;
    }
    Ok(())
}
