// TODO: this is hella ugly copy opencode or codex or something
// redo it pls

use ratatui::Frame;
use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Paragraph, Wrap};
use spicetify::fl;

use crate::app::{Page, RunStatus, TuiApp};
use crate::menu::CATEGORIES;
use crate::theme::{self, DESC_DIM, KEY_DIM, NEON_PINK, SUCCESS_GREEN};

pub(crate) fn draw(frame: &mut Frame<'_>, app: &mut TuiApp) {
    let term = frame.area();

    let content_width = term.width.saturating_sub(4).min(78);
    let h_margin = (term.width.saturating_sub(content_width)) / 2;
    let content = Rect {
        x: term.x.saturating_add(h_margin),
        y: term.y.saturating_add(1),
        width: content_width.max(1),
        height: term.height.saturating_sub(2).max(1),
    };

    let show_progress = app.status == RunStatus::Running;

    let mut constraints = vec![Constraint::Length(1), Constraint::Length(1)];
    if show_progress {
        constraints.extend([Constraint::Length(3), Constraint::Length(1)]);
    }
    constraints.extend([
        Constraint::Min(8),
        Constraint::Length(1),
        Constraint::Length(6),
        Constraint::Length(1),
        Constraint::Length(3),
    ]);

    let areas =
        Layout::default().direction(Direction::Vertical).constraints(constraints).split(content);
    let offset = if show_progress { 2 } else { 0 };
    let s: &[Rect] = &areas;

    #[expect(clippy::indexing_slicing)]
    let brand = s[0];
    #[expect(clippy::indexing_slicing)]
    let body = s[2 + offset];
    #[expect(clippy::indexing_slicing)]
    let log_area = s[4 + offset];
    #[expect(clippy::indexing_slicing)]
    let footer_area = s[6 + offset];

    draw_brand(frame, brand, app);
    if show_progress {
        #[expect(clippy::indexing_slicing)]
        let progress = s[2];
        draw_progress(frame, progress, app);
    }
    draw_body(frame, body, app);
    draw_log(frame, log_area, app);
    draw_footer(frame, footer_area, app);
    draw_version(frame);
}

fn draw_version(frame: &mut Frame<'_>) {
    let version = format!("v{}", spicetify::VERSION);
    #[expect(clippy::cast_possible_truncation)]
    let w = version.len() as u16;
    let area = frame.area();
    frame.render_widget(
        Paragraph::new(version).style(Style::default().fg(DESC_DIM).add_modifier(Modifier::DIM)),
        Rect {
            x: area.width.saturating_sub(w).saturating_sub(1),
            y: area.height.saturating_sub(1),
            width: w,
            height: 1,
        },
    );
}

fn draw_brand(frame: &mut Frame<'_>, area: Rect, app: &TuiApp) {
    let dot = theme::status_dot(app.daemon_running);
    let label = if app.daemon_running {
        format!(" {}", fl!("tui-running"))
    } else {
        format!(" {}", fl!("tui-stopped"))
    };

    let brand = "spicetify";
    let line_text = format!("{brand}  {dot}{label}");
    #[expect(clippy::cast_possible_truncation)]
    let pad = (area.width.saturating_sub(line_text.len() as u16)) / 2;

    frame.render_widget(
        Paragraph::new(Line::from(vec![
            Span::raw(" ".repeat(pad as usize)),
            Span::styled(brand, Style::default().fg(NEON_PINK).add_modifier(Modifier::BOLD)),
            Span::raw("  "),
            dot,
            Span::styled(label, Style::default().fg(DESC_DIM)),
        ])),
        area,
    );
}

fn draw_progress(frame: &mut Frame<'_>, area: Rect, app: &TuiApp) {
    let block = theme::panel("progress");
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let bar =
        theme::gradient_bar(inner.width.saturating_sub(2), app.progress_pct, app.spinner_frame);
    let pct = format!(" {:3.0}%", app.progress_pct * 100.0);
    let mut spans = vec![Span::raw(" ")];
    spans.extend(bar.spans.iter().cloned());
    spans.push(Span::styled(pct, Style::default().fg(NEON_PINK).add_modifier(Modifier::BOLD)));
    frame.render_widget(Paragraph::new(Line::from(spans)), inner);
}

fn draw_body(frame: &mut Frame<'_>, area: Rect, app: &mut TuiApp) {
    let block = theme::panel_tight();
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let [menu_area, _gap, details_area] = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(35),
            Constraint::Length(1),
            Constraint::Percentage(65),
        ])
        .split(inner)[..]
    else {
        return;
    };

    let sep_x = menu_area.x.saturating_add(menu_area.width);
    for row in 0..area.height {
        let ch = if row == 0 {
            "┬"
        } else if row == area.height.saturating_sub(1) {
            "┴"
        } else {
            "│"
        };
        frame.render_widget(
            Paragraph::new(ch).style(Style::default().fg(theme::BORDER_MUTED)),
            Rect { x: sep_x, y: area.y.saturating_add(row), width: 1, height: 1 },
        );
    }

    app.menu_rect = Some(menu_area);
    app.body_rect = Some(area);
    draw_menu(frame, menu_area, app);
    draw_details(frame, details_area, app);
}

fn draw_menu(frame: &mut Frame<'_>, area: Rect, app: &mut TuiApp) {
    let title = match app.page {
        Page::Main => String::from("categories"),
        Page::Category(i) => {
            CATEGORIES.get(i).map_or_else(|| fl!("tui-actions"), |c| c.id.label().to_lowercase())
        }
    };
    frame.render_widget(
        Paragraph::new(Line::from(Span::styled(
            format!(" {title}"),
            Style::default().fg(DESC_DIM).add_modifier(Modifier::BOLD),
        ))),
        Rect { x: area.x, y: area.y, width: area.width, height: 1 },
    );

    let content_top = area.y + 1;
    let items = app.menu_labels();
    if items.is_empty() {
        return;
    }

    let selected = app.selected;
    let hovered = app.hovered_row;

    for (i, item) in items.iter().enumerate() {
        #[expect(clippy::cast_possible_truncation)]
        let row_y = content_top.saturating_add(i as u16);
        let limit = area.y.saturating_add(area.height);
        if row_y >= limit {
            break;
        }

        let row_area = Rect { x: area.x, y: row_y, width: area.width, height: 1 };

        let prefix = if i == selected { " ▸ " } else { "   " };

        let style = if i == selected {
            theme::highlight()
        } else if Some(i) == hovered {
            theme::hover_style()
        } else {
            Style::default().fg(DESC_DIM)
        };

        let text = format!("{prefix}{item}");
        frame.render_widget(Paragraph::new(Line::from(Span::styled(text, style))), row_area);
    }
}

fn draw_details(frame: &mut Frame<'_>, area: Rect, app: &TuiApp) {
    let title = if app.current.is_some() { fl!("tui-running") } else { String::from("details") };
    frame.render_widget(
        Paragraph::new(Line::from(Span::styled(
            format!(" {title}"),
            Style::default().fg(DESC_DIM).add_modifier(Modifier::BOLD),
        ))),
        Rect { x: area.x, y: area.y, width: area.width, height: 1 },
    );

    let content_top = area.y + 1;
    let mut lines: Vec<Line<'_>> = app
        .details_lines()
        .into_iter()
        .enumerate()
        .map(|(i, s)| {
            if i == 0 {
                Line::from(Span::styled(
                    s,
                    Style::default().fg(NEON_PINK).add_modifier(Modifier::BOLD),
                ))
            } else {
                Line::from(Span::styled(s, Style::default().fg(DESC_DIM)))
            }
        })
        .collect();

    if let Some(cur) = app.current {
        let runtime = app
            .last_started_at
            .map_or_else(|| String::from("…"), |s| format!("{:.1}s", s.elapsed().as_secs_f64()));

        let result = match app.last_result {
            Some(RunStatus::Ok) => Span::styled(fl!("tui-ok"), Style::default().fg(SUCCESS_GREEN)),
            Some(RunStatus::Error) => {
                Span::styled(fl!("tui-error"), Style::default().fg(theme::ERROR_RED))
            }
            _ => Span::styled(fl!("tui-running"), Style::default().fg(NEON_PINK)),
        };

        lines.push(Line::from(""));
        lines.push(Line::from(vec![
            Span::styled("  ▶ ", Style::default().fg(NEON_PINK)),
            Span::raw(cur.label()),
        ]));
        lines.push(Line::from(vec![
            Span::styled("  ⏱ ", Style::default().fg(DESC_DIM)),
            Span::styled(runtime, Style::default().fg(KEY_DIM)),
            Span::raw("  "),
            Span::styled("✓ ", Style::default().fg(DESC_DIM)),
            result,
        ]));
    }

    frame.render_widget(
        Paragraph::new(lines).wrap(Wrap { trim: true }),
        Rect {
            x: area.x,
            y: content_top,
            width: area.width,
            height: area.height.saturating_sub(1),
        },
    );
}

fn draw_log(frame: &mut Frame<'_>, area: Rect, app: &TuiApp) {
    let block = theme::panel("log");
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let lines: Vec<Line<'_>> = app
        .logs
        .tail(inner.height as usize)
        .map(|raw| {
            let clean = strip_ansi(raw);
            let color = if clean.starts_with("ERROR") || clean.starts_with("FATAL") {
                theme::ERROR_RED
            } else if clean.starts_with("WARN") {
                theme::WARNING_YELLOW
            } else if raw.starts_with(">>>") {
                NEON_PINK
            } else if clean == "OK" {
                SUCCESS_GREEN
            } else {
                DESC_DIM
            };
            Line::from(Span::styled(format!(" {clean}"), Style::default().fg(color)))
        })
        .collect();

    frame.render_widget(Paragraph::new(lines).wrap(Wrap { trim: true }), inner);
}

fn draw_footer(frame: &mut Frame<'_>, area: Rect, app: &TuiApp) {
    if app.exit_armed_at.is_some() {
        let msg = "  press q or Ctrl+C again to confirm quit, any other key to cancel";
        #[expect(clippy::cast_possible_truncation)]
        let pad = (area.width.saturating_sub(msg.len() as u16)) / 2;
        frame.render_widget(
            Paragraph::new(Line::from(Span::styled(
                format!("{}{msg}", " ".repeat(pad as usize)),
                Style::default().fg(theme::WARNING_YELLOW),
            ))),
            area,
        );
        return;
    }

    let [nav_col, act_col] = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area)[..]
    else {
        return;
    };

    let mut nav_lines: Vec<Line<'static>> = vec![help_row("↑/k", "up"), help_row("↓/j", "down")];
    let mut act_lines: Vec<Line<'static>> =
        vec![help_row("enter", "select"), help_row("q/^c", "quit")];

    if matches!(app.page, Page::Category(_)) {
        nav_lines.push(help_row("←/h", "back"));
        act_lines.push(help_row("esc", "back"));
    }

    frame.render_widget(Paragraph::new(nav_lines), nav_col);
    frame.render_widget(Paragraph::new(act_lines), act_col);
}

fn help_row(key: &'static str, desc: &'static str) -> Line<'static> {
    Line::from(vec![
        Span::styled(
            format!(" {key:<6}"),
            Style::default().fg(KEY_DIM).add_modifier(Modifier::BOLD),
        ),
        Span::styled(desc, Style::default().fg(DESC_DIM)),
    ])
}

#[expect(clippy::indexing_slicing)]
fn strip_ansi(raw: &str) -> String {
    let bytes = raw.as_bytes();
    let mut out = String::with_capacity(raw.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == 0x1b && i + 1 < bytes.len() && bytes[i + 1] == b'[' {
            i += 2;
            while i < bytes.len() && bytes[i] != b'm' {
                i += 1;
            }
            if i < bytes.len() {
                i += 1;
            }
        } else {
            out.push(bytes[i] as char);
            i += 1;
        }
    }
    out
}
