use std::io;

use anyhow::Result;
use ratatui::{
    Terminal, backend::CrosstermBackend, layout::{Constraint, Direction, Layout}, style::{Color, Modifier, Style}, text::{Line, Span}, widgets::{List, ListItem, ListState, Paragraph, Wrap}
};

use super::{app::TuiApp, events::Action, theme};
use spicetify::i18n;

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
    let title = i18n::lookup("tui_session");
    let block = theme::border_block(&title);
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
        .unwrap_or_else(|| i18n::lookup("tui_idle_cmd").into());

    let header = Paragraph::new(vec![
        Line::from(vec![
            Span::styled(
                " SPICETIFY ",
                Style::default()
                    .fg(Color::Black)
                    .bg(theme::SPOTIFY_GREEN)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::raw(i18n::lookup("tui_subtitle")),
            Span::styled(
                format!(" {} ", spicetify::version::VersionInfo::load().display()),
                Style::default()
                    .fg(Color::DarkGray)
                    .add_modifier(Modifier::DIM),
            ),
            Span::styled(
                format!(" {} ", status_text),
                Style::default()
                    .fg(Color::Black)
                    .bg(status_color)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::raw("  "),
            Span::styled(
                i18n::lookup_with_args("tui_daemon_badge", &[("status", &daemon_text)]),
                Style::default()
                    .fg(Color::Black)
                    .bg(daemon_color)
                    .add_modifier(Modifier::BOLD),
            ),
        ]),
        Line::from(vec![
            Span::styled(
                i18n::lookup("tui_command_label"),
                Style::default().add_modifier(Modifier::BOLD),
            ),
            Span::raw(active),
        ]),
        Line::from(vec![
            Span::styled(
                i18n::lookup("tui_phase_label"),
                Style::default().add_modifier(Modifier::BOLD),
            ),
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

    let title = i18n::lookup("tui_actions");
    let list = List::new(items)
        .block(theme::border_block(&title))
        .highlight_symbol("> ")
        .highlight_style(theme::highlight_style());
    let mut list_state = ListState::default();
    list_state.select(Some(app.selected));
    frame.render_stateful_widget(list, main[0], &mut list_state);

    let side = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(5), Constraint::Min(3)])
        .split(main[1]);

    let selected = Action::ALL[app.selected];
    let title = i18n::lookup("tui_selected_action");
    let desc = Paragraph::new(vec![
        Line::from(Span::styled(
            selected.label(),
            Style::default()
                .fg(theme::SPOTIFY_GREEN)
                .add_modifier(Modifier::BOLD),
        )),
        Line::from(selected.summary()),
    ])
    .block(theme::border_block(&title))
    .wrap(Wrap { trim: true });
    frame.render_widget(desc, side[0]);

    let runtime = app
        .command_start
        .map(|s| format!("{:.1}s", s.elapsed().as_secs_f64()))
        .unwrap_or_else(|| i18n::lookup("tui_dash").into());
    let active = app
        .current_action
        .map(|a| a.label())
        .unwrap_or_else(|| i18n::lookup("tui_none").into());
    let result = match app.last_result {
        Some(true) => i18n::lookup("tui_ok"),
        Some(false) => i18n::lookup("tui_error"),
        None => i18n::lookup("tui_dash"),
    };
    let daemon = if app.daemon_running {
        i18n::lookup("tui_running")
    } else {
        i18n::lookup("tui_stopped")
    };

    let title = i18n::lookup("tui_run_stats");
    let stats = Paragraph::new(vec![
        Line::from(format!("{}: {}", i18n::lookup("tui_stat_active"), active)),
        Line::from(format!("{}: {}", i18n::lookup("tui_stat_runtime"), runtime)),
        Line::from(format!("{}: {}", i18n::lookup("tui_stat_logs"), app.logs.len())),
        Line::from(format!("{}: {}", i18n::lookup("tui_stat_last_result"), result)),
        Line::from(format!("{}: {}", i18n::lookup("tui_stat_daemon"), daemon)),
    ])
    .block(theme::border_block(&title));
    frame.render_widget(stats, side[1]);
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

    let title = i18n::lookup("tui_run_log");
    frame.render_widget(
        Paragraph::new(lines)
            .block(theme::border_block(&title))
            .style(Style::default())
            .wrap(Wrap { trim: true }),
        area,
    );
}

fn draw_footer(app: &TuiApp, frame: &mut ratatui::Frame, area: ratatui::layout::Rect) {
    let text = if app.exit_armed {
        i18n::lookup("footer_ctrlc")
    } else {
        i18n::lookup("footer_nav")
    };
    let keys_title = i18n::lookup("tui_keys");
    frame.render_widget(
        Paragraph::new(text)
            .style(Style::default().fg(Color::DarkGray))
            .block(theme::border_block(&keys_title)),
        area,
    );
}

fn status_badge(app: &TuiApp) -> (String, Color) {
    if app.running {
        (i18n::lookup("status_running").into(), Color::Yellow)
    } else {
        match app.last_result {
            Some(true) => (i18n::lookup("status_done").into(), Color::Green),
            Some(false) => (i18n::lookup("status_failed").into(), Color::Red),
            None => (i18n::lookup("status_idle").into(), Color::DarkGray),
        }
    }
}

fn daemon_badge(app: &TuiApp) -> (String, Color) {
    if app.daemon_running {
        (i18n::lookup("status_active").into(), Color::Green)
    } else {
        (i18n::lookup("status_off").into(), Color::DarkGray)
    }
}
