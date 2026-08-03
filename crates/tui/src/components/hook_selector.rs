use ratatui::Frame;
use ratatui::layout::Rect;
use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{ListState, Paragraph};
use spicetify::hooks::HookSet;

use crate::components::primitives::list as nav_list;
use crate::theme::{SPICE_ORANGE, TEXT_MUTED};

const AUTO_DETECT_LABEL: &str = "Auto-detect Spotify version";
const AUTO_DETECT_ROWS: usize = 1;

#[derive(Debug)]
pub(crate) struct HookSelector {
    pub(crate) sets: Vec<HookSet>,
    pub(crate) selected: usize,
    pub(crate) scroll: usize,
    pub(crate) visible_rows: usize,
    list_state: ListState,
}

impl HookSelector {
    pub(crate) fn new(sets: Vec<HookSet>) -> Self {
        let mut list_state = ListState::default();
        list_state.select(Some(0));

        Self { sets, selected: 0, scroll: 0, visible_rows: 0, list_state }
    }

    pub(crate) fn selected_set(&self) -> Option<&HookSet> {
        if self.selected < AUTO_DETECT_ROWS {
            return None;
        }
        self.sets.get(self.selected - AUTO_DETECT_ROWS)
    }

    pub(crate) fn is_auto_detect_selected(&self) -> bool {
        self.selected == 0
    }

    pub(crate) fn item_count(&self) -> usize {
        AUTO_DETECT_ROWS + self.sets.len()
    }

    pub(crate) fn move_up(&mut self) {
        let count = self.item_count();
        nav_list::move_selection(&mut self.selected, -1, count);
        self.list_state.select(Some(self.selected));
        nav_list::ensure_visible(self.selected, &mut self.scroll, self.visible_rows);
    }

    pub(crate) fn move_down(&mut self) {
        let count = self.item_count();
        nav_list::move_selection(&mut self.selected, 1, count);
        self.list_state.select(Some(self.selected));
        nav_list::ensure_visible(self.selected, &mut self.scroll, self.visible_rows);
    }

    fn labels(&self) -> Vec<String> {
        let mut labels = Vec::with_capacity(self.item_count());
        labels.push(AUTO_DETECT_LABEL.to_string());
        labels.extend(self.sets.iter().map(HookSet::display_label));
        labels
    }

    pub(crate) fn render(&mut self, frame: &mut Frame<'_>, area: Rect) {
        let labels = self.labels();

        let title_area =
            Rect { x: area.x + 2, y: area.y + 1, width: area.width.saturating_sub(4), height: 1 };

        let list_area = Rect {
            x: area.x + 2,
            y: area.y + 3,
            width: area.width.saturating_sub(4),
            height: area.height.saturating_sub(5),
        };

        self.visible_rows = list_area.height.max(1) as usize;

        frame.render_widget(
            Paragraph::new(Line::from(Span::styled(
                "Select a hook version",
                Style::default().fg(SPICE_ORANGE).add_modifier(Modifier::BOLD),
            ))),
            title_area,
        );

        nav_list::render(
            frame,
            list_area,
            &labels,
            self.scroll,
            Some(self.selected),
            None,
            false,
            |_real_idx, is_active, _is_keyboard| if is_active { " ▸ " } else { "   " },
        );

        let footer_y = list_area.y + list_area.height + 1;
        let footer = "\u{2191}\u{2193} to navigate  Enter to select  Esc to cancel";
        frame.render_widget(
            Paragraph::new(Span::styled(footer, Style::default().fg(TEXT_MUTED))),
            Rect { x: area.x + 2, y: footer_y, width: area.width.saturating_sub(4), height: 1 },
        );
    }
}
