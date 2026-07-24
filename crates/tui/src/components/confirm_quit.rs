use ratatui::Frame;
use ratatui::layout::{Alignment, Rect};
use ratatui::style::Style;
use ratatui::widgets::Paragraph;

use super::primitives::{button, dialog};
use crate::theme::TEXT_MUTED;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DialogHit {
    Yes,
    No,
    Close,
    Background,
}

pub(crate) fn draw_confirm_quit(
    frame: &mut Frame<'_>,
    mouse_pos: (u16, u16),
    mouse_active: bool,
    yes_focused: bool,
) -> Rect {
    let area = dialog::draw_dialog_styled(frame, 44, 7, Some(" quit "), mouse_pos, mouse_active);
    let inner = area.inner;

    frame.render_widget(
        Paragraph::new("Are you sure you want to quit?")
            .style(Style::default().fg(TEXT_MUTED))
            .alignment(Alignment::Center),
        Rect { x: inner.x, y: inner.y + 1, width: inner.width, height: 1 },
    );

    let btn_y = inner.y + 3;
    let left_pad = (inner.width.saturating_sub(16)) / 2;
    let yes_rect = Rect { x: inner.x + left_pad, y: btn_y, width: 6, height: 1 };
    let no_rect = Rect { x: inner.x + left_pad + 10, y: btn_y, width: 6, height: 1 };

    button::draw_button(frame, " Yep! ", yes_rect, mouse_pos, mouse_active, yes_focused);
    button::draw_button(frame, " Nope ", no_rect, mouse_pos, mouse_active, !yes_focused);

    area.outer
}

pub(crate) fn confirm_quit_hit_test(
    dialog_rect: Option<Rect>,
    col: u16,
    row: u16,
) -> Option<DialogHit> {
    match dialog::dialog_hit_test(dialog_rect, col, row) {
        dialog::DialogAreaHit::Background => return Some(DialogHit::Background),
        dialog::DialogAreaHit::Close => return Some(DialogHit::Close),
        dialog::DialogAreaHit::Inside => {}
    }
    let dialog = dialog_rect?;
    let inner = Rect {
        x: dialog.x + 1,
        y: dialog.y + 1,
        width: dialog.width.saturating_sub(2),
        height: dialog.height.saturating_sub(2),
    };
    let left_pad = (inner.width.saturating_sub(16)) / 2;
    let yes_rect = Rect { x: inner.x + left_pad, y: inner.y + 3, width: 6, height: 1 };
    let no_rect = Rect { x: inner.x + left_pad + 10, y: inner.y + 3, width: 6, height: 1 };
    if button::hit_test(yes_rect, col, row) {
        Some(DialogHit::Yes)
    } else if button::hit_test(no_rect, col, row) {
        Some(DialogHit::No)
    } else {
        None
    }
}
