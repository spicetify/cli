use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Span;
use ratatui::widgets::{Block, BorderType, Borders, Padding};

pub const PURPLE_HAZE: Color = Color::Rgb(0x5A, 0x56, 0xE0);
pub const NEON_PINK: Color = Color::Rgb(0xEE, 0x6F, 0xF8);
pub const BLUEBERRY: Color = Color::Rgb(0x75, 0x71, 0xF9);

pub const SURFACE_DARK: Color = Color::Rgb(0x34, 0x34, 0x42);
pub const SURFACE_HOVER: Color = Color::Rgb(0x40, 0x40, 0x50);
pub const SLATE: Color = Color::Rgb(0x78, 0x78, 0x78);
pub const BORDER_MUTED: Color = Color::Rgb(0x55, 0x55, 0x55);

pub const KEY_DIM: Color = Color::Rgb(0x94, 0x94, 0x94);
pub const DESC_DIM: Color = Color::Rgb(0x7E, 0x7E, 0x7E);

pub const SUCCESS_GREEN: Color = Color::Rgb(0x04, 0xB5, 0x75);
pub const ERROR_RED: Color = Color::Rgb(0xFF, 0x6B, 0x6B);
pub const WARNING_YELLOW: Color = Color::Rgb(0xEC, 0xFD, 0x65);

pub const SPINNER_FRAMES: [&str; 10] = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

#[must_use]
pub fn panel(title: &str) -> Block<'static> {
    Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(BORDER_MUTED))
        .title(format!(" {title} "))
        .title_style(Style::default().fg(DESC_DIM))
        .padding(Padding::horizontal(1))
}

#[must_use]
pub fn panel_tight() -> Block<'static> {
    Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(BORDER_MUTED))
}

#[must_use]
pub fn highlight() -> Style {
    Style::default().fg(NEON_PINK).bg(SURFACE_DARK).add_modifier(Modifier::BOLD)
}

#[must_use]
pub fn hover_style() -> Style {
    Style::default().bg(SURFACE_HOVER)
}

#[must_use]
pub fn status_dot(active: bool) -> Span<'static> {
    if active {
        Span::styled("●", Style::default().fg(SUCCESS_GREEN))
    } else {
        Span::styled("●", Style::default().fg(DESC_DIM))
    }
}

#[must_use]
pub fn gradient_at(t: f32) -> Color {
    let t = t.clamp(0.0, 1.0);

    #[rustfmt::skip]
    let stops: [(f32, Color); 5] = [
        (0.00, PURPLE_HAZE),
        (0.30, NEON_PINK),
        (0.55, Color::Rgb(0xF7, 0x93, 0xFF)),
        (0.75, Color::Rgb(0x22, 0xCC, 0xBB)),
        (1.00, SUCCESS_GREEN),
    ];

    for window in stops.windows(2) {
        let Some(&[stop_a, stop_b]) = TryInto::<&[_; 2]>::try_into(window).ok() else {
            continue;
        };
        let (a_t, a_c) = (stop_a.0, stop_a.1);
        let (b_t, b_c) = (stop_b.0, stop_b.1);
        if t <= b_t {
            let local = (t - a_t) / (b_t - a_t);
            return interpolate(a_c, b_c, local);
        }
    }

    stops.last().map_or(Color::Rgb(0, 0, 0), |s| s.1)
}

fn interpolate(color_a: Color, color_b: Color, factor: f32) -> Color {
    match (color_a, color_b) {
        (Color::Rgb(red_a, green_a, blue_a), Color::Rgb(red_b, green_b, blue_b)) => Color::Rgb(
            lerp_channel(red_a, red_b, factor),
            lerp_channel(green_a, green_b, factor),
            lerp_channel(blue_a, blue_b, factor),
        ),
        _ => color_a,
    }
}

#[expect(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn lerp_channel(channel_a: u8, channel_b: u8, factor: f32) -> u8 {
    let value = f32::from(channel_a).mul_add(1.0 - factor, f32::from(channel_b) * factor);
    value.clamp(0.0, 255.0).round() as u8
}

#[must_use]
pub fn gradient_bar(columns: u16, percent: f32, frame: usize) -> ratatui::text::Line<'static> {
    let count = usize::from(columns.max(1));

    #[expect(clippy::cast_possible_truncation, clippy::cast_sign_loss, clippy::cast_precision_loss)]
    let filled =
        if percent == 0.0 { 0 } else { (percent.clamp(0.0, 1.0) * count as f32).round() as usize };

    let spans: Vec<Span<'_>> = (0..count)
        .map(|idx| {
            #[expect(clippy::cast_precision_loss)]
            let position = idx as f32 / count as f32;
            let color = if idx < filled { gradient_at(position) } else { SLATE };
            let ch = if percent > 0.0 && idx == filled.saturating_sub(1) && frame.is_multiple_of(2)
            {
                "▐"
            } else {
                "▌"
            };
            Span::styled(ch, Style::default().fg(color))
        })
        .collect();

    ratatui::text::Line::from(spans)
}
