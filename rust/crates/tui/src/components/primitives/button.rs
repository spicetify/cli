use ratatui::Frame;
use ratatui::layout::{Position, Rect};
use ratatui::style::Style;
use ratatui::text::Span;
use ratatui::widgets::Paragraph;

use crate::theme;

pub(crate) fn draw_button(
    frame: &mut Frame<'_>,
    label: &str,
    rect: Rect,
    mouse_pos: (u16, u16),
    mouse_active: bool,
    focused: bool,
) {
    let hovered = mouse_active && rect.contains(Position::new(mouse_pos.0, mouse_pos.1));
    let style = if hovered || (!mouse_active && focused) {
        theme::highlight()
    } else {
        Style::default().fg(theme::TEXT_MUTED)
    };
    frame.render_widget(Paragraph::new(Span::styled(label, style)), rect);
}

pub(crate) fn hit_test(rect: Rect, col: u16, row: u16) -> bool {
    rect.contains(Position::new(col, row))
}
