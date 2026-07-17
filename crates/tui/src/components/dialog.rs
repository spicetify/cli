use ratatui::Frame;
use ratatui::layout::{Alignment, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Clear, Paragraph};

use crate::theme::{DIALOG_BG, SPICE_ORANGE, TEXT_MUTED};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DialogHit {
    Yes,
    No,
    Background,
}

pub(crate) fn draw_confirm_quit(
    frame: &mut Frame<'_>,
    mouse_pos: (u16, u16),
    mouse_active: bool,
    yes_focused: bool,
) -> Rect {
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
        Paragraph::new("Are you sure you want to quit?")
            .style(Style::default().fg(TEXT_MUTED))
            .alignment(Alignment::Center),
        Rect { x: inner.x, y: inner.y + 1, width: inner.width, height: 1 },
    );

    let btn_y = inner.y + 3;
    let left_pad = (inner.width.saturating_sub(16)) / 2;
    let yes_hover = mouse_pos.1 == btn_y
        && mouse_pos.0 >= inner.x + left_pad
        && mouse_pos.0 < inner.x + left_pad + 6;
    let no_hover = mouse_pos.1 == btn_y
        && mouse_pos.0 >= inner.x + left_pad + 10
        && mouse_pos.0 < inner.x + left_pad + 16;
    let mouse_active = mouse_active && (yes_hover || no_hover);

    let active_style =
        Style::default().fg(Color::Black).bg(SPICE_ORANGE).add_modifier(Modifier::BOLD);
    let muted_style = Style::default().fg(TEXT_MUTED);

    let yes_style = if mouse_active {
        if yes_hover { active_style } else { muted_style }
    } else if yes_focused {
        active_style
    } else {
        muted_style
    };
    let no_style = if mouse_active {
        if no_hover { active_style } else { muted_style }
    } else if yes_focused {
        muted_style
    } else {
        active_style
    };

    let yes = Span::styled(" Yep! ", yes_style);
    let no = Span::styled(" Nope ", no_style);

    frame.render_widget(
        Paragraph::new(Line::from(vec![yes, Span::raw("    "), no])).alignment(Alignment::Center),
        Rect { x: inner.x, y: inner.y + 3, width: inner.width, height: 1 },
    );

    dialog_area
}

pub(crate) fn confirm_quit_hit_test(dialog_rect: Option<Rect>, col: u16, row: u16) -> DialogHit {
    let Some(dialog) = dialog_rect else { return DialogHit::Background };
    let inner = Rect {
        x: dialog.x + 1,
        y: dialog.y + 1,
        width: dialog.width.saturating_sub(2),
        height: dialog.height.saturating_sub(2),
    };
    if row != inner.y + 3 {
        return DialogHit::Background;
    }
    let left_pad = (inner.width.saturating_sub(16)) / 2;
    let yes_x_end = inner.x + left_pad + 6;
    if col >= inner.x + left_pad && col < yes_x_end {
        DialogHit::Yes
    } else if col >= inner.x + left_pad + 10 && col < inner.x + left_pad + 16 {
        DialogHit::No
    } else {
        DialogHit::Background
    }
}
