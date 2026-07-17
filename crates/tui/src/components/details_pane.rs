use ratatui::Frame;
use ratatui::layout::Rect;
use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use spicetify::fl;

use super::menu_list::MenuAction;
use crate::app::{InputState, RunStatus};
use crate::theme::{self, SPICE_ORANGE, SUCCESS_GREEN, TEXT_MUTED, TEXT_SECONDARY};

pub(crate) struct DetailsCtx<'a> {
    pub(crate) details_lines: Vec<String>,
    pub(crate) input: Option<&'a InputState>,
    pub(crate) current_action: Option<MenuAction>,
    pub(crate) status: RunStatus,
    pub(crate) runtime_secs: Option<String>,
    pub(crate) spinner_glyph: Option<&'static str>,
}

pub(crate) fn render(frame: &mut Frame<'_>, area: Rect, ctx: &DetailsCtx<'_>) {
    if let Some(input) = ctx.input {
        let cursor = format!("{}{}█", input.prompt(), input.buffer);
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

    let mut lines: Vec<Line<'_>> = ctx
        .details_lines
        .iter()
        .enumerate()
        .map(|(i, s)| {
            if i == 0 {
                Line::from(Span::styled(
                    s.as_str(),
                    Style::default().fg(SPICE_ORANGE).add_modifier(Modifier::BOLD),
                ))
            } else {
                Line::from(Span::styled(s.as_str(), Style::default().fg(TEXT_MUTED)))
            }
        })
        .collect();

    if let Some(cur) = ctx.current_action {
        let runtime = ctx.runtime_secs.as_deref().unwrap_or("…");

        let result = match ctx.status {
            RunStatus::Ok => Span::styled(fl!("tui-ok"), Style::default().fg(SUCCESS_GREEN)),
            RunStatus::Error => {
                Span::styled(fl!("tui-error"), Style::default().fg(theme::ERROR_RED))
            }
            _ => Span::styled(fl!("tui-running"), Style::default().fg(SPICE_ORANGE)),
        };

        lines.push(Line::from(""));
        let prefix = if ctx.status == RunStatus::Running {
            ctx.spinner_glyph.unwrap_or("▶")
        } else {
            "▶"
        };
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

    frame.render_widget(Paragraph::new(lines).wrap(ratatui::widgets::Wrap { trim: true }), area);
}
