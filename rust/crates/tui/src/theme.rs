use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Span;
use ratatui::widgets::{Block, BorderType, Borders, Padding};

pub const SPICE_ORANGE: Color = Color::Rgb(0xFF, 0x64, 0x37);

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
pub fn status_dot(active: bool) -> Span<'static> {
    if active {
        Span::styled("●", Style::default().fg(SUCCESS_GREEN))
    } else {
        Span::styled("●", Style::default().fg(TEXT_MUTED))
    }
}
