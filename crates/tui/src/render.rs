// TODO: this is hella ugly copy opencode or codex or something
// redo it pls

use ratatui::Frame;
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Clear, Paragraph, Wrap};
use spicetify::fl;

use crate::app::{Page, RunStatus, TuiApp};
use crate::menu::CATEGORIES;
use crate::theme::{self, DIALOG_BG, SPICE_ORANGE, SUCCESS_GREEN, TEXT_MUTED, TEXT_SECONDARY};

pub(crate) fn draw(frame: &mut Frame<'_>, app: &mut TuiApp) {
    let content = content_area(frame.area());

    let [brand, _, body, log, _, footer] = Layout::vertical([
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Length(8),
        Constraint::Min(12),
        Constraint::Length(1),
        Constraint::Length(3),
    ])
    .areas::<6>(content);

    draw_brand(frame, brand, app);
    draw_body(frame, body, app);
    draw_log(frame, log, app);
    draw_footer(frame, footer, app);
    draw_version(frame);

    if app.dialog.confirm_quit {
        draw_confirm_quit(frame, app);
    }
}

fn content_area(term: Rect) -> Rect {
    let content_width = term.width.saturating_sub(4).min(78);
    let h_margin = (term.width.saturating_sub(content_width)) / 2;
    Rect {
        x: term.x.saturating_add(h_margin),
        y: term.y.saturating_add(4),
        width: content_width.max(1),
        height: term.height.saturating_sub(8).max(1),
    }
}

fn draw_version(frame: &mut Frame<'_>) {
    let version = format!("v{}", spicetify::VERSION);
    #[expect(clippy::cast_possible_truncation)]
    let w = version.len() as u16;
    let area = frame.area();
    frame.render_widget(
        Paragraph::new(version).style(Style::default().fg(TEXT_MUTED)),
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

    let brand_style = Style::default().fg(SPICE_ORANGE).add_modifier(Modifier::BOLD);
    frame.render_widget(
        Paragraph::new(Line::from(vec![
            Span::raw(" ".repeat(pad as usize)),
            Span::styled(brand, brand_style),
            Span::raw("  "),
            dot,
            Span::styled(label, Style::default().fg(TEXT_MUTED)),
        ])),
        area,
    );
}

fn draw_body(frame: &mut Frame<'_>, area: Rect, app: &mut TuiApp) {
    let inner = Rect {
        x: area.x + 1,
        y: area.y + 1,
        width: area.width.saturating_sub(2),
        height: area.height.saturating_sub(2),
    };

    #[expect(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let menu_width = (f32::from(inner.width) * 0.35).round() as u16;
    let menu_width = menu_width.min(inner.width.saturating_sub(2));
    let details_width = inner.width.saturating_sub(menu_width).saturating_sub(1);
    let sep_x = inner.x + menu_width;

    let menu_area = Rect { x: inner.x, y: inner.y, width: menu_width, height: inner.height };
    let details_area =
        Rect { x: sep_x + 1, y: inner.y, width: details_width, height: inner.height };

    let in_category = matches!(app.nav.page, Page::Category(_));
    let mut menu_title = match app.nav.page {
        Page::Main => "categories".to_string(),
        Page::Category(i) => {
            CATEGORIES.get(i).map_or_else(|| fl!("tui-actions"), |c| c.id.label().to_lowercase())
        }
    };
    if in_category {
        menu_title = format!("← {menu_title}");
    }
    let details_title = if app.input.is_some() {
        "input".to_string()
    } else if app.cmd.current.is_some() {
        fl!("tui-running")
    } else {
        "details".to_string()
    };

    let sep_offset = (sep_x - area.x) as usize;
    let border_style = Style::default().fg(theme::BORDER_MUTED);

    let top = build_border_top(area.width as usize, sep_offset, &menu_title, &details_title);
    frame.render_widget(
        Paragraph::new(top).style(border_style),
        Rect { x: area.x, y: area.y, width: area.width, height: 1 },
    );

    for row in 1_u16..area.height.saturating_sub(1) {
        let y = area.y + row;
        frame.render_widget(
            Paragraph::new("│").style(border_style),
            Rect { x: area.x, y, width: 1, height: 1 },
        );
        frame.render_widget(
            Paragraph::new("│").style(border_style),
            Rect { x: sep_x, y, width: 1, height: 1 },
        );
        frame.render_widget(
            Paragraph::new("│").style(border_style),
            Rect { x: area.x + area.width - 1, y, width: 1, height: 1 },
        );
    }

    let bottom = build_border_bottom(area.width as usize, sep_offset);
    frame.render_widget(
        Paragraph::new(bottom).style(border_style),
        Rect { x: area.x, y: area.y + area.height - 1, width: area.width, height: 1 },
    );

    app.layout.menu_rect = Some(menu_area);
    app.layout.body_rect = Some(area);
    app.layout.back_rect = if in_category {
        Some(Rect { x: area.x, y: area.y, width: sep_x.saturating_sub(area.x), height: 1 })
    } else {
        None
    };
    draw_menu(frame, menu_area, app);
    draw_details(frame, details_area, app);
}

fn build_border_top(width: usize, sep: usize, left_title: &str, right_title: &str) -> String {
    let mut s = String::with_capacity(width);
    s.push('╭');
    fill_section(&mut s, sep.saturating_sub(1), left_title);
    s.push('┬');
    fill_section(&mut s, width.saturating_sub(sep).saturating_sub(2), right_title);
    s.push('╮');
    s
}

fn build_border_bottom(width: usize, sep: usize) -> String {
    let mut s = String::with_capacity(width);
    s.push('╰');
    s.push_str(&"─".repeat(sep.saturating_sub(1)));
    s.push('┴');
    s.push_str(&"─".repeat(width.saturating_sub(sep).saturating_sub(2)));
    s.push('╯');
    s
}

fn fill_section(s: &mut String, available_width: usize, title: &str) {
    let formatted = format!(" {title} ");
    if formatted.len() < available_width {
        s.push_str(&formatted);
        s.push_str(&"─".repeat(available_width - formatted.len()));
    } else {
        s.push_str(&"─".repeat(available_width));
    }
}

fn draw_menu(frame: &mut Frame<'_>, area: Rect, app: &mut TuiApp) {
    let items = app.menu_labels();
    if items.is_empty() {
        return;
    }

    let selected = app.nav.selected;
    let hovered = app.layout.hover.index;
    let mouse_active = app.layout.hover.is_mouse_active() && hovered.is_some();

    for (i, item) in items.iter().enumerate() {
        #[expect(clippy::cast_possible_truncation)]
        let row_y = area.y.saturating_add(i as u16);
        let limit = area.y.saturating_add(area.height);
        if row_y >= limit {
            break;
        }

        let row_area = Rect { x: area.x, y: row_y, width: area.width, height: 1 };
        let prefix = if !mouse_active && i == selected { " ▸ " } else { "   " };

        let style = if mouse_active {
            if Some(i) == hovered { theme::highlight() } else { Style::default().fg(TEXT_MUTED) }
        } else if i == selected {
            theme::highlight()
        } else {
            Style::default().fg(TEXT_MUTED)
        };

        let text = format!("{prefix}{item}");
        frame.render_widget(Paragraph::new(Line::from(Span::styled(text, style))), row_area);
    }
}

fn draw_details(frame: &mut Frame<'_>, area: Rect, app: &TuiApp) {
    if let Some(input) = &app.input {
        let prompt = input.prompt();
        let cursor = format!("{}{}█", prompt, input.buffer);
        frame.render_widget(
            Paragraph::new(Line::from(Span::styled(
                cursor,
                Style::default().fg(SPICE_ORANGE).add_modifier(Modifier::BOLD),
            ))),
            Rect { x: area.x, y: area.y, width: area.width, height: 1 },
        );
        frame.render_widget(
            Paragraph::new("esc to cancel, enter to submit").style(Style::default().fg(TEXT_MUTED)),
            Rect { x: area.x, y: area.y + 1, width: area.width, height: 1 },
        );
        return;
    }

    let mut lines: Vec<Line<'_>> = app
        .details_lines()
        .into_iter()
        .enumerate()
        .map(|(i, s)| {
            if i == 0 {
                Line::from(Span::styled(
                    s,
                    Style::default().fg(SPICE_ORANGE).add_modifier(Modifier::BOLD),
                ))
            } else {
                Line::from(Span::styled(s, Style::default().fg(TEXT_MUTED)))
            }
        })
        .collect();

    if let Some(cur) = app.cmd.current {
        let runtime = app
            .cmd
            .last_started_at
            .map_or_else(|| String::from("…"), |s| format!("{:.1}s", s.elapsed().as_secs_f64()));

        let result = match app.cmd.status {
            RunStatus::Ok => Span::styled(fl!("tui-ok"), Style::default().fg(SUCCESS_GREEN)),
            RunStatus::Error => {
                Span::styled(fl!("tui-error"), Style::default().fg(theme::ERROR_RED))
            }
            _ => Span::styled(fl!("tui-running"), Style::default().fg(SPICE_ORANGE)),
        };

        lines.push(Line::from(""));
        let prefix = if app.cmd.status == RunStatus::Running { app.spinner_glyph() } else { "▶" };
        lines.push(Line::from(vec![
            Span::styled(format!("  {prefix} "), Style::default().fg(SPICE_ORANGE)),
            Span::raw(cur.label()),
        ]));
        lines.push(Line::from(vec![
            Span::styled("  ⏱ ", Style::default().fg(TEXT_MUTED)),
            Span::styled(runtime, Style::default().fg(TEXT_SECONDARY)),
            Span::raw("  "),
            Span::styled("✓ ", Style::default().fg(TEXT_MUTED)),
            result,
        ]));
    }

    frame.render_widget(Paragraph::new(lines).wrap(Wrap { trim: true }), area);
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
            } else if clean.starts_with(">>>") {
                SPICE_ORANGE
            } else if clean == "OK" {
                SUCCESS_GREEN
            } else {
                TEXT_MUTED
            };
            Line::from(Span::styled(format!(" {clean}"), Style::default().fg(color)))
        })
        .collect();

    frame.render_widget(Paragraph::new(lines).wrap(Wrap { trim: true }), inner);
}

fn draw_confirm_quit(frame: &mut Frame<'_>, app: &mut TuiApp) {
    let question = "Are you sure you want to quit?";

    let dialog_w: u16 = 44;
    let dialog_h: u16 = 7;

    let term = frame.area();
    let dialog_area = Rect {
        x: term.x + (term.width.saturating_sub(dialog_w)) / 2,
        y: term.y + (term.height.saturating_sub(dialog_h)) / 2,
        width: dialog_w,
        height: dialog_h,
    };

    frame.render_widget(Clear, dialog_area);

    app.layout.dialog_rect = Some(dialog_area);

    let bg = ratatui::widgets::Block::default().style(Style::default().bg(DIALOG_BG));
    frame.render_widget(bg, dialog_area);

    let block = ratatui::widgets::Block::default()
        .borders(ratatui::widgets::Borders::ALL)
        .border_type(ratatui::widgets::BorderType::Rounded)
        .border_style(Style::default().fg(SPICE_ORANGE))
        .title(" quit ")
        .title_style(Style::default().fg(TEXT_MUTED))
        .padding(ratatui::widgets::Padding::horizontal(1));
    let inner = block.inner(dialog_area);
    frame.render_widget(block, dialog_area);

    frame.render_widget(
        Paragraph::new(question)
            .style(Style::default().fg(TEXT_MUTED))
            .alignment(Alignment::Center),
        Rect { x: inner.x, y: inner.y + 1, width: inner.width, height: 1 },
    );
    let yes_active = app.dialog.confirm_quit_yes;
    let no_active = !app.dialog.confirm_quit_yes;

    let (mouse_col, mouse_row) = app.layout.mouse_pos;
    let btn_y = inner.y + 3;
    let left_pad = (inner.width.saturating_sub(16)) / 2;
    let yes_hover =
        mouse_row == btn_y && mouse_col >= inner.x + left_pad && mouse_col < inner.x + left_pad + 6;
    let no_hover = mouse_row == btn_y
        && mouse_col >= inner.x + left_pad + 10
        && mouse_col < inner.x + left_pad + 16;
    let mouse_active = app.layout.hover.is_mouse_active() && (yes_hover || no_hover);

    let active = Style::default().fg(Color::Black).bg(SPICE_ORANGE).add_modifier(Modifier::BOLD);
    let muted = Style::default().fg(TEXT_MUTED);

    let yes_style = if mouse_active {
        if yes_hover { active } else { muted }
    } else if yes_active {
        active
    } else {
        muted
    };
    let no_style = if mouse_active {
        if no_hover { active } else { muted }
    } else if no_active {
        active
    } else {
        muted
    };

    let yes = Span::styled(" Yep! ", yes_style);
    let no = Span::styled(" Nope ", no_style);

    frame.render_widget(
        Paragraph::new(Line::from(vec![yes, Span::raw("    "), no])).alignment(Alignment::Center),
        Rect { x: inner.x, y: inner.y + 3, width: inner.width, height: 1 },
    );
}

fn draw_footer(frame: &mut Frame<'_>, area: Rect, app: &TuiApp) {
    if app.dialog.confirm_quit {
        return;
    }

    let [nav_col, act_col] = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area)[..]
    else {
        return;
    };

    let (nav_lines, act_lines) = if app.input.is_some() {
        (vec![help_row("esc", "cancel")], vec![help_row("enter", "submit")])
    } else {
        let mut nav = vec![help_row("↑/k", "up"), help_row("↓/j", "down")];
        let mut act = vec![help_row("enter", "select"), help_row("q/^c", "quit")];
        if matches!(app.nav.page, Page::Category(_)) {
            nav.push(help_row("←/h", "back"));
            act.push(help_row("esc", "back"));
        }
        (nav, act)
    };

    frame.render_widget(Paragraph::new(nav_lines), nav_col);
    frame.render_widget(Paragraph::new(act_lines), act_col);
}

fn help_row(key: &'static str, desc: &'static str) -> Line<'static> {
    Line::from(vec![
        Span::styled(
            format!(" {key:<6}"),
            Style::default().fg(TEXT_SECONDARY).add_modifier(Modifier::BOLD),
        ),
        Span::styled(desc, Style::default().fg(TEXT_MUTED)),
    ])
}

#[expect(clippy::indexing_slicing, clippy::manual_is_ascii_check)]
fn strip_ansi(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    let bytes = raw.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == 0x1b && i + 1 < bytes.len() && bytes[i + 1] == b'[' {
            i += 2;
            while i < bytes.len() && !matches!(bytes[i], b'A'..=b'Z' | b'a'..=b'z') {
                i += 1;
            }
            i += 1;
        } else {
            let start = i;
            while i < bytes.len() && bytes[i] != 0x1b {
                i += 1;
            }
            out.push_str(&raw[start..i]);
        }
    }
    out
}
