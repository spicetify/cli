use ratatui::Frame;
use ratatui::layout::Rect;
use ratatui::style::Style;
use ratatui::text::{Line, Span};
use ratatui::widgets::{List, ListItem};

use crate::theme;

#[expect(clippy::cast_possible_wrap)]
pub(crate) fn move_selection(selected: &mut usize, delta: isize, item_count: usize) {
    if item_count == 0 {
        return;
    }
    let cur = *selected as isize + delta;
    *selected = cur.rem_euclid(item_count as isize) as usize;
}

pub(crate) fn ensure_visible(selected: usize, scroll: &mut usize, visible_height: usize) {
    if visible_height == 0 {
        return;
    }
    if selected < *scroll {
        *scroll = selected;
    } else if selected >= *scroll + visible_height {
        *scroll = selected.saturating_sub(visible_height.saturating_sub(1));
    }
}

pub(crate) fn visible_range(
    scroll: usize,
    visible_height: usize,
    item_count: usize,
) -> (usize, usize) {
    let start = scroll.min(item_count.saturating_sub(1));
    let end = (start + visible_height).min(item_count);
    (start, end)
}

#[expect(clippy::too_many_arguments)]
pub(crate) fn render(
    frame: &mut Frame<'_>,
    area: Rect,
    labels: &[impl AsRef<str>],
    scroll: usize,
    selected: Option<usize>,
    hovered: Option<usize>,
    is_mouse_active: bool,
    prefix: impl Fn(usize, bool, bool) -> &'static str,
) {
    let active_idx: Option<usize> = if is_mouse_active { hovered } else { selected };

    let visible_height = area.height.max(1) as usize;
    let (start, end) = visible_range(scroll, visible_height, labels.len());

    let items: Vec<ListItem<'_>> = labels
        .get(start..end)
        .unwrap_or(&[])
        .iter()
        .enumerate()
        .map(|(vi, label)| {
            let real_idx = start + vi;
            let is_active = Some(real_idx) == active_idx;
            let is_keyboard = Some(real_idx) == selected && !is_mouse_active;
            let pfx = prefix(real_idx, is_active, is_keyboard);
            let style = if is_active { theme::highlight() } else { Style::default() };
            ListItem::new(Line::from(Span::styled(format!("{pfx}{}", label.as_ref()), style)))
        })
        .collect();

    frame.render_widget(List::new(items), area);
}
