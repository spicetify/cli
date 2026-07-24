use ratatui::Frame;
use ratatui::layout::Rect;
use ratatui::style::Style;
use ratatui::widgets::Paragraph;

use super::button;
use crate::theme;

pub(crate) struct SplitPane {
    pub left_area: Rect,
    pub right_area: Rect,
    pub back_rect: Rect,
}

#[expect(clippy::too_many_arguments)]
pub(crate) fn draw(
    frame: &mut Frame<'_>,
    area: Rect,
    left_title: &str,
    right_title: &str,
    split_pct: f32,
    show_back: bool,
    mouse_pos: (u16, u16),
    mouse_active: bool,
) -> SplitPane {
    let inner = Rect {
        x: area.x + 1,
        y: area.y + 1,
        width: area.width.saturating_sub(2),
        height: area.height.saturating_sub(2),
    };

    #[expect(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let left_width = (f32::from(inner.width) * split_pct).round() as u16;
    let left_width = left_width.min(inner.width.saturating_sub(2));
    let right_width = inner.width.saturating_sub(left_width).saturating_sub(1);
    let sep_x = inner.x + left_width;

    let left_area = Rect { x: inner.x, y: inner.y, width: left_width, height: inner.height };
    let right_area = Rect { x: sep_x + 1, y: inner.y, width: right_width, height: inner.height };

    let sep_offset = (sep_x - area.x) as usize;
    let border_style = Style::default().fg(theme::BORDER_MUTED);

    let top = build_top(area.width as usize, sep_offset, left_title, right_title);
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

    let bottom = build_bottom(area.width as usize, sep_offset);
    frame.render_widget(
        Paragraph::new(bottom).style(border_style),
        Rect { x: area.x, y: area.y + area.height - 1, width: area.width, height: 1 },
    );

    let back_rect = if show_back {
        let rect = Rect { x: area.x, y: area.y, width: sep_x.saturating_sub(area.x), height: 1 };
        button::draw_button(
            frame,
            "← ",
            Rect { x: area.x + 2, y: area.y, width: 2, height: 1 },
            mouse_pos,
            mouse_active,
            false,
        );
        rect
    } else {
        Rect::default()
    };

    SplitPane { left_area, right_area, back_rect }
}

fn build_top(width: usize, sep: usize, left_title: &str, right_title: &str) -> String {
    let mut s = String::with_capacity(width);
    s.push('╭');
    fill_section(&mut s, sep.saturating_sub(1), left_title);
    s.push('┬');
    fill_section(&mut s, width.saturating_sub(sep).saturating_sub(2), right_title);
    s.push('╮');
    s
}

fn build_bottom(width: usize, sep: usize) -> String {
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
    let char_width = formatted.chars().count();
    if char_width < available_width {
        s.push_str(&formatted);
        s.push_str(&"─".repeat(available_width - char_width));
    } else {
        s.push_str(&"─".repeat(available_width));
    }
}
