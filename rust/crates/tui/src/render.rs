use ratatui::Frame;
use ratatui::layout::{Alignment, Constraint, Layout, Rect};
use ratatui::style::Style;
use ratatui::widgets::Paragraph;
use spicetify::fl;

use crate::app::{Page, TuiApp};
use crate::components::primitives::{button, split_pane};
use crate::components::{confirm_quit, details_pane, footer};
use crate::theme::TEXT_MUTED;

pub(crate) fn draw(frame: &mut Frame<'_>, app: &mut TuiApp) {
    let term_area = frame.area();

    if draw_small_term_warning(frame, term_area) {
        return;
    }

    let content = content_area(term_area);
    let (brand, body, log, footer_area) = compute_layout(content);

    app.layout.log_rect = Some(log);
    app.header.render(frame, brand);

    let (menu_title, in_category) = get_menu_title(app.menu.page);
    let details_title = get_details_title(app);

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

    draw_clear_button(frame, app, log);

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
}

fn draw_small_term_warning(frame: &mut Frame<'_>, area: Rect) -> bool {
    if area.width >= 45 && area.height >= 15 {
        return false;
    }

    let text =
        format!("Terminal too small\nMinimum: 45x15 | Current: {}x{}", area.width, area.height);
    let warning =
        Paragraph::new(text).alignment(Alignment::Center).style(Style::default().fg(TEXT_MUTED));

    let [_, warning_area, _] =
        Layout::vertical([Constraint::Fill(1), Constraint::Length(2), Constraint::Fill(1)])
            .areas::<3>(area);

    frame.render_widget(warning, warning_area);
    true
}

fn compute_layout(content: Rect) -> (Rect, Rect, Rect, Rect) {
    if content.width >= 100 {
        let [brand, _, main_area, _, footer_area] = Layout::vertical([
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Min(6),
            Constraint::Length(1),
            Constraint::Length(3),
        ])
        .areas::<5>(content);

        let [body, log] =
            Layout::horizontal([Constraint::Percentage(50), Constraint::Percentage(50)])
                .areas::<2>(main_area);

        (brand, body, log, footer_area)
    } else {
        let [brand, _, body, log, _, footer_area] = Layout::vertical([
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Length(8),
            Constraint::Min(4),
            Constraint::Length(1),
            Constraint::Length(3),
        ])
        .areas::<6>(content);

        (brand, body, log, footer_area)
    }
}

fn get_menu_title(page: Page) -> (String, bool) {
    let in_category = matches!(page, Page::Category(_));
    let mut menu_title = match page {
        Page::Main => "categories".to_string(),
        Page::Category(i) => {
            let data = crate::components::menu_list::CATEGORIES;
            data.get(i).map_or_else(|| fl!("tui-actions"), |c| c.id.label().to_lowercase())
        }
    };
    if in_category {
        menu_title = format!("← {menu_title}");
    }
    (menu_title, in_category)
}

fn get_details_title(app: &TuiApp) -> String {
    if app.input.is_some() {
        "input".to_string()
    } else if app.cmd.current.is_some() {
        fl!("tui-running")
    } else {
        "details".to_string()
    }
}

fn draw_clear_button(frame: &mut Frame<'_>, app: &mut TuiApp, log: Rect) {
    let button_w = log.width.min(5);
    let clear_rect = Rect {
        x: log.x + log.width.saturating_sub(button_w),
        y: log.y,
        width: button_w,
        height: 1,
    };
    app.layout.clear_rect = Some(clear_rect);
    button::draw_button(
        frame,
        "clear",
        clear_rect,
        app.layout.mouse_pos,
        app.menu.hover.is_mouse_active(),
        false,
    );
}

fn content_area(term: Rect) -> Rect {
    let h_margin = if term.width >= 120 { 2 } else { u16::from(term.width >= 80) };
    let v_margin = u16::from(term.height >= 24);

    Rect {
        x: term.x.saturating_add(h_margin),
        y: term.y.saturating_add(v_margin),
        width: term.width.saturating_sub(h_margin * 2).max(1),
        height: term.height.saturating_sub(v_margin * 2).max(1),
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
            width: w.min(area.width),
            height: 1,
        },
    );
}
