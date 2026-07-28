use ratatui::Frame;
use ratatui::layout::Rect;
use ratatui::style::{Color, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Paragraph, Scrollbar, ScrollbarOrientation, ScrollbarState, Wrap};
use tracing::Level;

use super::super::log_buffer::LogBuffer;
use crate::theme::{ERROR_RED, TEXT_MUTED, WARNING_YELLOW};

const SCROLL_STEP: usize = 3;

#[derive(Debug)]
pub(crate) struct LogViewer {
    pub(crate) buffer: LogBuffer,
    scroll: usize,
    visible_lines: usize,
}

impl LogViewer {
    pub(crate) fn new(capacity: usize) -> Self {
        Self { buffer: LogBuffer::new(capacity), scroll: 0, visible_lines: 0 }
    }

    pub(crate) fn push(&mut self, entry: impl Into<crate::log_buffer::LogEntry>) {
        if self.scroll > 0 {
            self.scroll = self.scroll.saturating_add(1);
        }
        self.buffer.push(entry);
    }

    pub(crate) fn scroll_up(&mut self) {
        let visible = self.visible_lines.max(1);
        let max_scroll = self.buffer.len().saturating_sub(visible);
        self.scroll = (self.scroll + SCROLL_STEP).min(max_scroll);
    }

    pub(crate) fn scroll_down(&mut self) {
        self.scroll = self.scroll.saturating_sub(SCROLL_STEP);
    }

    pub(crate) fn clear(&mut self) {
        self.buffer.clear();
        self.scroll = 0;
    }

    pub(crate) fn render(&mut self, frame: &mut Frame<'_>, area: Rect, panel_title: &str) {
        let block = crate::theme::panel(panel_title);
        let inner = block.inner(area);
        frame.render_widget(block, area);

        let visible_rows = inner.height as usize;
        self.visible_lines = visible_rows;
        if visible_rows == 0 {
            return;
        }

        let total = self.buffer.len();
        let offset = self.scroll;
        let fetch = (visible_rows + offset).min(total);
        let entries: Vec<_> = self.buffer.tail(fetch).collect();
        let end = entries.len().saturating_sub(offset);

        let lines: Vec<Line<'_>> = entries
            .iter()
            .take(end)
            .map(|entry| {
                let (level_color, msg_color) = match entry.level {
                    Level::ERROR => (ERROR_RED, ERROR_RED),
                    Level::WARN => (WARNING_YELLOW, WARNING_YELLOW),
                    Level::INFO => (Color::Rgb(0x66, 0x99, 0xCC), Color::Rgb(0xD4, 0xD4, 0xD4)),
                    Level::DEBUG | Level::TRACE => (TEXT_MUTED, TEXT_MUTED),
                };
                let level_str = format!("{:<5}", entry.level.as_str());
                Line::from(vec![
                    Span::styled(level_str, Style::default().fg(level_color)),
                    Span::styled(&entry.message, Style::default().fg(msg_color)),
                ])
            })
            .collect();

        frame.render_widget(Paragraph::new(lines).wrap(Wrap { trim: true }), inner);
        Self::render_scrollbar(frame, inner, total, visible_rows, offset);
    }

    fn render_scrollbar(
        frame: &mut Frame<'_>,
        inner: Rect,
        total: usize,
        visible: usize,
        offset: usize,
    ) {
        if total <= visible {
            return;
        }
        let scrollbar_area = Rect {
            x: inner.x + inner.width.saturating_sub(1),
            y: inner.y,
            width: 1,
            height: inner.height,
        };
        let max_scroll = total.saturating_sub(visible);
        let scroll_pos = (total.saturating_sub(offset)).saturating_sub(visible).min(max_scroll);
        let mut scrollbar_state = ScrollbarState::new(max_scroll).position(scroll_pos);
        frame.render_stateful_widget(
            Scrollbar::new(ScrollbarOrientation::VerticalRight),
            scrollbar_area,
            &mut scrollbar_state,
        );
    }
}
