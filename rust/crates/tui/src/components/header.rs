use ratatui::Frame;
use ratatui::layout::Rect;
use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use spicetify::fl;

use crate::theme::{self, SPICE_ORANGE, TEXT_MUTED};

#[derive(Debug)]
pub(crate) struct Header {
    pub(crate) spinner_frame: usize,
    pub(crate) daemon_running: bool,
}

impl Header {
    pub(crate) fn new(daemon_running: bool) -> Self {
        Self { spinner_frame: 0, daemon_running }
    }

    pub(crate) fn spinner_glyph(&self) -> &'static str {
        theme::SPINNER_FRAMES
            .get(self.spinner_frame % theme::SPINNER_FRAMES.len())
            .copied()
            .unwrap_or("⠋")
    }

    pub(crate) fn tick_spinner(&mut self) {
        self.spinner_frame = (self.spinner_frame + 1) % theme::SPINNER_FRAMES.len();
    }

    pub(crate) fn render(&self, frame: &mut Frame<'_>, area: Rect) {
        let dot = theme::status_dot(self.daemon_running);
        let label = if self.daemon_running {
            format!(" {}", fl!("tui-running"))
        } else {
            format!(" {}", fl!("tui-stopped"))
        };

        let brand = "spicetify";
        let line_text = format!("{brand}  {dot}{label}");
        #[expect(clippy::cast_possible_truncation)]
        let pad = (area.width.saturating_sub(line_text.chars().count() as u16)) / 2;

        let brand_style = Style::default().fg(SPICE_ORANGE).add_modifier(Modifier::BOLD);
        frame.render_widget(
            Paragraph::new(Line::from(vec![
                Span::raw(" ".repeat(pad as usize)),
                Span::styled(brand, brand_style),
                Span::raw("  "),
                dot,
                Span::styled(label, Style::default().fg(TEXT_MUTED)),
            ])),
            area,
        );
    }
}
