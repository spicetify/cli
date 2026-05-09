use std::io;

use anyhow::Result;
use ratatui::{
    Terminal, backend::CrosstermBackend, layout::{Constraint, Direction, Layout}, style::{Color, Modifier, Style}, text::{Line, Span}, widgets::{List, ListItem, ListState, Paragraph, Wrap}
};

use super::{app::TuiApp, events::Action, theme};

pub fn draw(app: &TuiApp, terminal: &mut Terminal<CrosstermBackend<io::Stdout>>) -> Result<()> {
    terminal.draw(|frame| {
        let layout = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(5),
                Constraint::Min(10),
                Constraint::Length(11),
                Constraint::Length(3),
            ])
            .split(frame.area());

        draw_session_header(app, frame, layout[0]);
        draw_main_area(app, frame, layout[1]);
        draw_run_log(app, frame, layout[2]);
        draw_footer(app, frame, layout[3]);
    })?;
    Ok(())
}

fn draw_session_header(app: &TuiApp, frame: &mut ratatui::Frame, area: ratatui::layout::Rect) {
    let block = theme::border_block("Session");
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let split = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Min(10), Constraint::Length(12)])
        .split(inner);

    let (status_text, status_color) = status_badge(app);
    let (daemon_text, daemon_color) = daemon_badge(app);
    let active = app
        .current_action
        .map(|a| format!("spicetify {}", a.label()))
        .unwrap_or_else(|| "spicetify <idle>".into());

    let header = Paragraph::new(vec![
        Line::from(vec![
            Span::styled(
                " SPICETIFY ",
                Style::default()
                    .fg(Color::Black)
                    .bg(theme::SPOTIFY_GREEN)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::raw("  Spotify Customization Console  "),
            Span::styled(
                format!(" {} ", status_text),
                Style::default()
                    .fg(Color::Black)
                    .bg(status_color)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::raw("  "),
            Span::styled(
                format!(" daemon {} ", daemon_text),
                Style::default()
                    .fg(Color::Black)
                    .bg(daemon_color)
                    .add_modifier(Modifier::BOLD),
            ),
        ]),
        Line::from(vec![
            Span::styled(" Command: ", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(active),
        ]),
        Line::from(vec![
            Span::styled(" Phase: ", Style::default().add_modifier(Modifier::BOLD)),
            Span::raw(app.phase.clone()),
        ]),
    ]);
    frame.render_widget(header, split[0]);

    let pose = theme::BUDDY_POSES[app.buddy_frame];
    let clawd = Paragraph::new(vec![
        Line::from(format!(" {}", pose[0])),
        Line::from(format!(" {}", pose[1])),
        Line::from(format!(" {}", pose[2])),
    ]);
    frame.render_widget(clawd, split[1]);
}

fn draw_main_area(app: &TuiApp, frame: &mut ratatui::Frame, area: ratatui::layout::Rect) {
    let main = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(44), Constraint::Percentage(56)])
        .split(area);

    let items = Action::ALL
        .iter()
        .map(|a| ListItem::new(Line::from(format!("{:<14} {}", a.label(), a.summary()))))
        .collect::<Vec<_>>();

    let list = List::new(items)
        .block(theme::border_block("Actions"))
        .highlight_symbol("> ")
        .highlight_style(theme::highlight_style());
    let mut list_state = ListState::default();
    list_state.select(Some(app.selected));
    frame.render_stateful_widget(list, main[0], &mut list_state);

    let side = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4),
            Constraint::Length(5),
            Constraint::Min(3),
        ])
        .split(main[1]);

    let selected = Action::ALL[app.selected];
    let desc = Paragraph::new(vec![
        Line::from(Span::styled(
            selected.label(),
            Style::default()
                .fg(theme::SPOTIFY_GREEN)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(selected.summary()),
    ])
    .block(theme::border_block("Selected Action"))
    .wrap(Wrap { trim: true });
    frame.render_widget(desc, side[0]);

    let pct = (app.progress * 100.0).round() as u16;
    let spinner = theme::SPINNER_FRAMES[app.spinner];
    let content_width = usize::from(side[1].width.saturating_sub(4));
    let meter_width = content_width.saturating_sub(2).clamp(1, 40);
    let filled = (app.progress.clamp(0.0, 1.0) * meter_width as f64).round() as usize;
    let meter = format!(
        "[{}{}]",
        "=".repeat(filled),
        ".".repeat(meter_width.saturating_sub(filled))
    );

    let meter_status = if app.running {
        format!("{} {}% complete", spinner, pct)
    } else if app.last_result == Some(true) {
        format!("done {}%", pct)
    } else if app.last_result == Some(false) {
        format!("stopped {}%", pct)
    } else {
        format!("ready {}%", pct)
    };

    let progress = Paragraph::new(vec![
        Line::from(Span::styled(
            "Spicetify pipeline",
            Style::default()
                .fg(theme::SPOTIFY_GREEN)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(meter_status),
        Line::from(meter),
    ])
    .block(theme::border_block("Progress Meter"))
    .wrap(Wrap { trim: true });
    frame.render_widget(progress, side[1]);

    let runtime = app
        .command_start
        .map(|s| format!("{:.1}s", s.elapsed().as_secs_f64()))
        .unwrap_or_else(|| "-".into());
    let active = app.current_action.map(|a| a.label()).unwrap_or("none");
    let result = match app.last_result {
        Some(true) => "ok",
        Some(false) => "error",
        None => "-",
    };
    let daemon = if app.daemon_running {
        "running"
    } else {
        "stopped"
    };

    let stats = Paragraph::new(vec![
        Line::from(format!("active: {active}")),
        Line::from(format!("runtime: {runtime}")),
        Line::from(format!("logs: {}", app.logs.len())),
        Line::from(format!("last result: {result}")),
        Line::from(format!("daemon: {daemon}")),
    ])
    .block(theme::border_block("Run Stats"));
    frame.render_widget(stats, side[2]);
}

fn draw_run_log(app: &TuiApp, frame: &mut ratatui::Frame, area: ratatui::layout::Rect) {
    let mut lines = Vec::new();
    for line_text in app.logs.tail(theme::LAST_RUN_VISIBLE) {
        let style = if line_text.starts_with("ERROR") || line_text.starts_with("FATAL") {
            Style::default().fg(theme::ERROR_RED)
        } else if line_text.starts_with("WARN") {
            Style::default().fg(theme::WARN_YELLOW)
        } else if line_text.starts_with("INFO") {
            Style::default().fg(theme::INFO_BLUE)
        } else {
            Style::default().fg(Color::White)
        };
        lines.push(Line::from(Span::styled(line_text.clone(), style)));
    }

    frame.render_widget(
        Paragraph::new(lines)
            .block(theme::border_block("Run Log"))
            .style(Style::default())
            .wrap(Wrap { trim: true }),
        area,
    );
}

fn draw_footer(app: &TuiApp, frame: &mut ratatui::Frame, area: ratatui::layout::Rect) {
    let text = if app.exit_armed {
        "Press Ctrl+C again to quit"
    } else {
        "Up/Down: navigate    Enter: run    Ctrl+C twice: quit"
    };
    frame.render_widget(
        Paragraph::new(text)
            .style(Style::default().fg(Color::DarkGray))
            .block(theme::border_block("Keys")),
        area,
    );
}

fn status_badge(app: &TuiApp) -> (&'static str, Color) {
    if app.running {
        ("RUNNING", Color::Yellow)
    } else {
        match app.last_result {
            Some(true) => ("DONE", Color::Green),
            Some(false) => ("FAILED", Color::Red),
            None => ("IDLE", Color::DarkGray),
        }
    }
}

fn daemon_badge(app: &TuiApp) -> (&'static str, Color) {
    if app.daemon_running {
        ("ACTIVE", Color::Green)
    } else {
        ("OFF", Color::DarkGray)
    }
}
