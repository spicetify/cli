use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Span;
use ratatui::widgets::{Block, BorderType, Borders, Padding};

pub const BURNT_ORANGE: Color = Color::Rgb(0xE5, 0x54, 0x2B);
pub const SPICE_ORANGE: Color = Color::Rgb(0xFF, 0x64, 0x37);
pub const SPICE_AMBER: Color = Color::Rgb(0xFF, 0x9A, 0x4D);

pub const DIALOG_BG: Color = Color::Rgb(0x14, 0x14, 0x14);
pub const SURFACE_DARK: Color = Color::Rgb(0x34, 0x34, 0x42);
pub const SURFACE_HOVER: Color = Color::Rgb(0x40, 0x40, 0x50);
pub const SLATE: Color = Color::Rgb(0x78, 0x78, 0x78);
pub const BORDER_MUTED: Color = Color::Rgb(0x55, 0x55, 0x55);

pub const TEXT_SECONDARY: Color = Color::Rgb(0x94, 0x94, 0x94);
pub const TEXT_MUTED: Color = Color::Rgb(0x7E, 0x7E, 0x7E);

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
        .title_style(Style::default().fg(TEXT_MUTED))
        .padding(Padding::horizontal(1))
}

#[must_use]
pub fn highlight() -> Style {
    Style::default().fg(Color::Black).bg(SPICE_ORANGE).add_modifier(Modifier::BOLD)
}

#[must_use]
pub fn hover_style() -> Style {
    highlight()
}

#[must_use]
pub fn status_dot(active: bool) -> Span<'static> {
    if active {
        Span::styled("●", Style::default().fg(SUCCESS_GREEN))
    } else {
        Span::styled("●", Style::default().fg(TEXT_MUTED))
    }
}

#[must_use]
pub fn gradient_at(t: f32) -> Color {
    let t = t.clamp(0.0, 1.0);

    #[rustfmt::skip]
    let stops: [(f32, Color); 5] = [
        (0.00, BURNT_ORANGE),
        (0.30, SPICE_ORANGE),
        (0.55, Color::Rgb(0xFF, 0x8C, 0x5A)),
        (0.75, Color::Rgb(0xFF, 0xB0, 0x67)),
        (1.00, SUCCESS_GREEN),
    ];

    for i in 0..stops.len().saturating_sub(1) {
        let Some((a_t, a_c)) = stops.get(i).map(|s| (s.0, s.1)) else { continue };
        let Some((b_t, b_c)) = stops.get(i + 1).map(|s| (s.0, s.1)) else { continue };
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
