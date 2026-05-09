mod app;
mod events;
mod render;
mod theme;

use std::io;

use anyhow::Result;
use crossterm::{
    execute, terminal::{EnterAlternateScreen, LeaveAlternateScreen, disable_raw_mode, enable_raw_mode}
};
use ratatui::{Terminal, backend::CrosstermBackend};

use self::app::TuiApp;
use crate::config::AppContext;

pub fn run(ctx: &AppContext) -> Result<()> {
    let mut terminal = setup_terminal()?;
    let mut app = TuiApp::new(ctx);
    let result = app.run(&mut terminal);
    restore_terminal(&mut terminal)?;
    result
}

fn setup_terminal() -> Result<Terminal<CrosstermBackend<io::Stdout>>> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    Terminal::new(CrosstermBackend::new(stdout)).map_err(Into::into)
}

fn restore_terminal(terminal: &mut Terminal<CrosstermBackend<io::Stdout>>) -> Result<()> {
    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;
    Ok(())
}
