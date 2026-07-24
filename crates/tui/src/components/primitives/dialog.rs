use ratatui::Frame;
use ratatui::layout::Rect;
use ratatui::style::Style;
use ratatui::widgets::{Block, Borders, Clear};

use super::button;
use crate::theme::{SPICE_ORANGE, TEXT_MUTED};

const CLOSE_WIDTH: u16 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DialogAreaHit {
    Close,
    Background,
    Inside,
}

pub(crate) struct DialogArea {
    pub outer: Rect,
    pub inner: Rect,
}

fn centered(term: Rect, width: u16, height: u16) -> Rect {
    let x = term.x + (term.width.saturating_sub(width)) / 2;
    let y = term.y + (term.height.saturating_sub(height)) / 2;
    Rect { x, y, width, height }
}

fn close_rect(outer: Rect) -> Rect {
    let inner_x = outer.x + 1;
    let inner_y = outer.y + 1;
    let inner_w = outer.width.saturating_sub(2);
    Rect { x: inner_x + inner_w - CLOSE_WIDTH, y: inner_y, width: CLOSE_WIDTH, height: 1 }
}

fn draw_close_button(
    frame: &mut Frame<'_>,
    outer: Rect,
    mouse_pos: (u16, u16),
    mouse_active: bool,
) {
    let cr = close_rect(outer);
    button::draw_button(frame, " X ", cr, mouse_pos, mouse_active, false);
}

pub(crate) fn draw_dialog(
    frame: &mut Frame<'_>,
    width: u16,
    height: u16,
    mouse_pos: (u16, u16),
    mouse_active: bool,
) -> DialogArea {
    let outer = centered(frame.area(), width, height);

    frame.render_widget(Clear, outer);

    let block =
        Block::default().borders(Borders::ALL).border_style(Style::default().fg(SPICE_ORANGE));
    let inner = block.inner(outer);
    frame.render_widget(block, outer);

    draw_close_button(frame, outer, mouse_pos, mouse_active);

    DialogArea { outer, inner }
}

pub(crate) fn draw_dialog_styled(
    frame: &mut Frame<'_>,
    width: u16,
    height: u16,
    title: Option<&str>,
    mouse_pos: (u16, u16),
    mouse_active: bool,
) -> DialogArea {
    let outer = centered(frame.area(), width, height);

    frame.render_widget(Clear, outer);

    let mut block =
        Block::default().borders(Borders::ALL).border_style(Style::default().fg(SPICE_ORANGE));
    if let Some(title) = title {
        block = block.title(title).title_style(Style::default().fg(TEXT_MUTED));
    }
    let inner = block.inner(outer);
    frame.render_widget(block, outer);

    draw_close_button(frame, outer, mouse_pos, mouse_active);

    DialogArea { outer, inner }
}

pub(crate) fn dialog_hit_test(dialog_rect: Option<Rect>, col: u16, row: u16) -> DialogAreaHit {
    let Some(outer) = dialog_rect else { return DialogAreaHit::Background };
    if col < outer.x
        || col >= outer.x.saturating_add(outer.width)
        || row < outer.y
        || row >= outer.y.saturating_add(outer.height)
    {
        return DialogAreaHit::Background;
    }
    let cr = close_rect(outer);
    if col >= cr.x && col < cr.x.saturating_add(cr.width) && row == cr.y {
        return DialogAreaHit::Close;
    }
    DialogAreaHit::Inside
}
