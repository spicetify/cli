use ratatui::Frame;
use ratatui::layout::Rect;
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
    let hovered = mouse_active
        && mouse_pos.1 >= rect.y
        && mouse_pos.1 < rect.y.saturating_add(rect.height)
        && mouse_pos.0 >= rect.x
        && mouse_pos.0 < rect.x.saturating_add(rect.width);
    let style = if hovered || (!mouse_active && focused) {
        theme::highlight()
    } else {
        Style::default().fg(theme::TEXT_MUTED)
    };
    frame.render_widget(Paragraph::new(Span::styled(label, style)), rect);
}

pub(crate) fn hit_test(rect: Rect, col: u16, row: u16) -> bool {
    col >= rect.x
        && col < rect.x.saturating_add(rect.width)
        && row >= rect.y
        && row < rect.y.saturating_add(rect.height)
}
