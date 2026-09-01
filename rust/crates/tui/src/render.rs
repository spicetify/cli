use ratatui::Frame;
use ratatui::layout::{Alignment, Constraint, Layout, Margin, Rect};
use ratatui::style::Style;
use ratatui::widgets::Paragraph;
use spicetify::fl;

use crate::app::{LayoutState, Page, TuiApp};
use crate::components::primitives::{button, split_pane};
use crate::components::{confirm_quit, details_pane, footer};
use crate::theme::TEXT_MUTED;

const MIN_TERMINAL_WIDTH: u16 = 45;
const MIN_TERMINAL_HEIGHT: u16 = 15;
const WIDE_CONTENT_WIDTH: u16 = 100;

pub(crate) fn draw(frame: &mut Frame<'_>, app: &mut TuiApp) {
    if draw_small_term_warning(frame, &mut app.layout) {
        return;
    }

    let content = content_area(frame.area());
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

fn draw_small_term_warning(frame: &mut Frame<'_>, layout: &mut LayoutState) -> bool {
    let area = frame.area();
    if area.width >= MIN_TERMINAL_WIDTH && area.height >= MIN_TERMINAL_HEIGHT {
        return false;
    }

    layout.clear_interaction_regions();

    let text = format!(
        "Terminal too small\nMinimum: {MIN_TERMINAL_WIDTH}x{MIN_TERMINAL_HEIGHT} | Current: {}x{}",
        area.width, area.height
    );
    let warning =
        Paragraph::new(text).alignment(Alignment::Center).style(Style::default().fg(TEXT_MUTED));

    let [_, warning_area, _] =
        Layout::vertical([Constraint::Fill(1), Constraint::Length(2), Constraint::Fill(1)])
            .areas::<3>(area);

    frame.render_widget(warning, warning_area);
    true
}

fn compute_layout(content: Rect) -> (Rect, Rect, Rect, Rect) {
    if content.width >= WIDE_CONTENT_WIDTH {
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

    term.inner(Margin { horizontal: h_margin, vertical: v_margin })
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

#[cfg(test)]
mod tests {
    use std::error::Error;

    use ratatui::Terminal;
    use ratatui::backend::TestBackend;
    use ratatui::buffer::Cell;

    use super::*;
    use crate::LayoutState;

    fn populated_layout() -> LayoutState {
        let rect = Some(Rect::new(1, 1, 8, 4));
        LayoutState {
            menu_rect: rect,
            body_rect: rect,
            log_rect: rect,
            clear_rect: rect,
            back_rect: rect,
            dialog_rect: rect,
            mouse_pos: (7, 9),
        }
    }

    #[test]
    fn small_terminals_show_warning_and_clear_interaction_regions() -> Result<(), Box<dyn Error>> {
        for (width, height) in [(44, 15), (45, 14), (80, 14)] {
            let mut terminal = Terminal::new(TestBackend::new(width, height))?;
            let mut layout = populated_layout();

            let _completed_frame = terminal.draw(|frame| {
                assert!(draw_small_term_warning(frame, &mut layout));
            })?;

            assert!(layout.menu_rect.is_none());
            assert!(layout.body_rect.is_none());
            assert!(layout.log_rect.is_none());
            assert!(layout.clear_rect.is_none());
            assert!(layout.back_rect.is_none());
            assert!(layout.dialog_rect.is_none());
            assert_eq!(layout.mouse_pos, (7, 9));
            assert!(!layout.mouse_interactions_enabled());

            let screen =
                terminal.backend().buffer().content().iter().map(Cell::symbol).collect::<String>();
            assert!(screen.contains("Terminal too small"));
            assert!(screen.contains(&format!(
                "Minimum: {MIN_TERMINAL_WIDTH}x{MIN_TERMINAL_HEIGHT} | Current: {width}x{height}"
            )));
        }

        Ok(())
    }

    #[test]
    fn minimum_terminal_size_does_not_show_warning() -> Result<(), Box<dyn Error>> {
        let mut terminal = Terminal::new(TestBackend::new(45, 15))?;
        let mut layout = populated_layout();

        let _completed_frame = terminal.draw(|frame| {
            assert!(!draw_small_term_warning(frame, &mut layout));
        })?;

        assert_eq!(layout.menu_rect, Some(Rect::new(1, 1, 8, 4)));
        assert_eq!(layout.mouse_pos, (7, 9));
        assert!(layout.mouse_interactions_enabled());

        Ok(())
    }

    #[test]
    fn screen_sizes_select_the_expected_layout() {
        let cases = [
            (
                45,
                15,
                Rect::new(0, 0, 45, 15),
                Rect::new(0, 2, 45, 5),
                Rect::new(0, 7, 45, 4),
                Rect::new(0, 12, 45, 3),
            ),
            (
                79,
                23,
                Rect::new(0, 0, 79, 23),
                Rect::new(0, 2, 79, 8),
                Rect::new(0, 10, 79, 9),
                Rect::new(0, 20, 79, 3),
            ),
            (
                80,
                24,
                Rect::new(1, 1, 78, 22),
                Rect::new(1, 3, 78, 8),
                Rect::new(1, 11, 78, 8),
                Rect::new(1, 20, 78, 3),
            ),
            (
                101,
                24,
                Rect::new(1, 1, 99, 22),
                Rect::new(1, 3, 99, 8),
                Rect::new(1, 11, 99, 8),
                Rect::new(1, 20, 99, 3),
            ),
            (
                102,
                24,
                Rect::new(1, 1, 100, 22),
                Rect::new(1, 3, 50, 16),
                Rect::new(51, 3, 50, 16),
                Rect::new(1, 20, 100, 3),
            ),
            (
                119,
                23,
                Rect::new(1, 0, 117, 23),
                Rect::new(1, 2, 59, 17),
                Rect::new(60, 2, 58, 17),
                Rect::new(1, 20, 117, 3),
            ),
            (
                120,
                24,
                Rect::new(2, 1, 116, 22),
                Rect::new(2, 3, 58, 16),
                Rect::new(60, 3, 58, 16),
                Rect::new(2, 20, 116, 3),
            ),
            (
                160,
                40,
                Rect::new(2, 1, 156, 38),
                Rect::new(2, 3, 78, 32),
                Rect::new(80, 3, 78, 32),
                Rect::new(2, 36, 156, 3),
            ),
        ];

        for (width, height, expected_content, expected_body, expected_log, expected_footer) in cases
        {
            let content = content_area(Rect::new(0, 0, width, height));
            let (_, body, log, footer) = compute_layout(content);

            assert_eq!(content, expected_content);
            assert_eq!(body, expected_body, "unexpected body at {width}x{height}");
            assert_eq!(log, expected_log, "unexpected log at {width}x{height}");
            assert_eq!(footer, expected_footer, "unexpected footer at {width}x{height}");
        }
    }
}
