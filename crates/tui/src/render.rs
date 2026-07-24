use ratatui::Frame;
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::Style;
use ratatui::widgets::Paragraph;
use spicetify::fl;

use crate::app::{Page, TuiApp};
use crate::components::primitives::{dialog, split_pane};
use crate::components::{confirm_quit, details_pane, footer};
use crate::theme::TEXT_MUTED;

pub(crate) fn draw(frame: &mut Frame<'_>, app: &mut TuiApp) {
    let content = content_area(frame.area());

    let [brand, _, body, log, _, footer_area] = Layout::vertical([
        Constraint::Length(1),
        Constraint::Length(1),
        Constraint::Length(8),
        Constraint::Min(12),
        Constraint::Length(1),
        Constraint::Length(3),
    ])
    .areas::<6>(content);

    app.layout.log_rect = Some(log);
    app.header.render(frame, brand);

    let in_category = matches!(app.menu.page, Page::Category(_));
    let mut menu_title = match app.menu.page {
        Page::Main => "categories".to_string(),
        Page::Category(i) => {
            let data = crate::components::menu_list::CATEGORIES;
            data.get(i).map_or_else(|| fl!("tui-actions"), |c| c.id.label().to_lowercase())
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

    let pane = split_pane::draw(
        frame,
        body,
        &menu_title,
        &details_title,
        0.35,
        in_category,
        app.layout.mouse_pos,
        app.menu.hover.is_mouse_active(),
    );

    app.layout.menu_rect = Some(pane.left_area);
    app.layout.body_rect = Some(body);
    app.layout.back_rect = if in_category { Some(pane.back_rect) } else { None };

    app.menu.render(frame, pane.left_area);

    let details_ctx = details_pane::DetailsCtx {
        details_lines: app.menu.details_lines(),
        input: app.input.as_ref(),
        current_action: app.cmd.current,
        status: app.cmd.status,
        runtime_secs: app.cmd.last_started_at.map(|s| format!("{:.1}s", s.elapsed().as_secs_f64())),
        spinner_glyph: Some(app.header.spinner_glyph()),
    };
    details_pane::render(frame, pane.right_area, &details_ctx);

    app.log_viewer.render(frame, log, "log");

    let footer_ctx = footer::FooterCtx {
        page: app.menu.page,
        input_active: app.input.is_some(),
        dialog_open: app.confirm_quit_open,
    };
    footer::render(frame, footer_area, &footer_ctx);

    draw_version(frame);

    if app.confirm_quit_open {
        app.layout.dialog_rect = Some(confirm_quit::draw_confirm_quit(
            frame,
            app.layout.mouse_pos,
            app.menu.hover.is_mouse_active(),
            app.confirm_quit_yes,
        ));
    }

    if app.hook_selector.is_some() {
        let area = dialog::draw_dialog(
            frame,
            60,
            18,
            app.layout.mouse_pos,
            app.menu.hover.is_mouse_active(),
        );
        app.layout.dialog_rect = Some(area.outer);
        if let Some(ref mut selector) = app.hook_selector {
            selector.render(frame, area.outer);
        }
    }
}

fn content_area(term: Rect) -> Rect {
    let content_width = term.width.saturating_sub(3).min(78);
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
