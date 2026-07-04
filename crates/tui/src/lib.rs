mod app;
mod frame_scheduler;
mod log_buffer;
mod menu;
mod render;
pub mod theme;

use std::io;

use anyhow::Result;
pub use app::{Page, RunStatus, TuiApp};
use crossterm::event::{DisableMouseCapture, EnableMouseCapture};
use crossterm::execute;
use crossterm::terminal::{
    EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode
};
use i18n_embed_fl as _;
pub use log_buffer::LogBuffer;
pub use menu::{CategoryId, MenuAction};
use ratatui::Terminal;
use ratatui::backend::CrosstermBackend;
use spicetify::context::AppContext;

pub fn run(ctx: &AppContext) -> Result<()> {
    let (tx, rx) = std::sync::mpsc::channel();
    spicetify::logging::init_for_tui(&tx)?;
    let mut terminal = setup_terminal()?;

    let runtime = tokio::runtime::Builder::new_current_thread().enable_time().build()?;
    let result = runtime.block_on(async {
        let (draw_tx, draw_rx) = tokio::sync::broadcast::channel(16);
        let frame_req = frame_scheduler::FrameRequester::new(draw_tx);
        let mut app = TuiApp::new(ctx.clone(), tx, rx, frame_req, draw_rx);
        app.run_async(&mut terminal).await
    });
    restore_terminal(&mut terminal)?;
    result
}

fn setup_terminal() -> Result<Terminal<CrosstermBackend<io::Stdout>>> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    Terminal::new(CrosstermBackend::new(stdout)).map_err(Into::into)
}

fn restore_terminal(terminal: &mut Terminal<CrosstermBackend<io::Stdout>>) -> Result<()> {
    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen, DisableMouseCapture)?;
    terminal.show_cursor()?;
    Ok(())
}
