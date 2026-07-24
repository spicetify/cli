mod app;
pub(crate) mod components;
mod frame_scheduler;
pub mod log_buffer;
mod render;
pub mod theme;

use std::io;

use anyhow::Result;
pub use app::{LayoutState, Page, RunStatus, TuiApp};
use crossterm::event::{DisableMouseCapture, EnableMouseCapture};
use crossterm::execute;
use crossterm::terminal::{
    EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode
};
use i18n_embed_fl as _;
pub use log_buffer::LogBuffer;
use ratatui::Terminal;
use ratatui::backend::CrosstermBackend;
use spicetify::context::AppContext;
use tokio::sync::broadcast;

use crate::frame_scheduler::FrameRequester;

pub fn run(ctx: &AppContext) -> Result<()> {
    let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
    spicetify::logging::init_for_tui(tx.clone())?;
    spicetify::update::startup_cleanup();
    let mut terminal = setup_terminal()?;

    let runtime =
        tokio::runtime::Builder::new_current_thread().enable_time().enable_io().build()?;
    let panic_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        runtime.block_on(async {
            let (draw_tx, _) = broadcast::channel(1);
            let frame_requester = FrameRequester::new(draw_tx.clone());
            let mut app = TuiApp::new(ctx.clone(), tx, rx, frame_requester, draw_tx);
            app.run_async(&mut terminal).await
        })
    }));
    restore_terminal(&mut terminal)?;
    match panic_result {
        Ok(result) => result,
        Err(payload) => std::panic::resume_unwind(payload),
    }
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
