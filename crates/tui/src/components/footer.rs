use ratatui::Frame;
use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;

use crate::app::Page;
use crate::theme::{TEXT_MUTED, TEXT_SECONDARY};

pub(crate) struct FooterCtx {
    pub(crate) page: Page,
    pub(crate) input_active: bool,
    pub(crate) dialog_open: bool,
}

pub(crate) fn render(frame: &mut Frame<'_>, area: Rect, ctx: &FooterCtx) {
    if ctx.dialog_open {
        return;
    }

    let [nav_col, act_col] = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area)[..]
    else {
        return;
    };

    let (nav_lines, act_lines) = if ctx.input_active {
        (vec![help_row("esc", "cancel")], vec![help_row("enter", "submit")])
    } else {
        let mut nav =
            vec![help_row("↑/k", "up"), help_row("↓/j", "down"), help_row("pgup", "log ↑")];
        let mut act = vec![help_row("enter", "select"), help_row("q/^c", "quit")];
        if matches!(ctx.page, Page::Category(_)) {
            nav.push(help_row("←/h", "back"));
            act.push(help_row("pgdn", "log ↓"));
        } else {
            act.push(help_row("pgdn", "log ↓"));
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
