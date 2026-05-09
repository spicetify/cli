use ratatui::style::{Color, Modifier, Style};

pub const SPINNER_FRAMES: [&str; 4] = ["-", "\\", "|", "/"];

pub const BUDDY_POSES: [[&str; 3]; 4] = [
    [" ▐▛███▜▌", "▝▜█████▛▘", "  ▘▘ ▝▝  "],
    [" ▐▟███▟▌", "▝▜█████▛▘", "  ▘▘ ▝▝  "],
    [" ▐▙███▙▌", "▝▜█████▛▘", "  ▘▘ ▝▝  "],
    ["▗▟▛███▜▙▖", " ▜█████▛ ", "  ▘▘ ▝▝  "],
];

pub const LAST_RUN_VISIBLE: usize = 14;

pub const SPOTIFY_GREEN: Color = Color::Rgb(30, 215, 96);
pub const ERROR_RED: Color = Color::Rgb(248, 113, 113);
pub const WARN_YELLOW: Color = Color::Rgb(250, 204, 21);
pub const INFO_BLUE: Color = Color::Rgb(125, 211, 252);
pub const BORDER_GRAY: Color = Color::Rgb(75, 85, 99);
pub const TITLE_GRAY: Color = Color::Rgb(156, 163, 175);

pub fn border_block(title: &str) -> ratatui::widgets::Block<'_> {
    ratatui::widgets::Block::default()
        .borders(ratatui::widgets::Borders::ALL)
        .border_type(ratatui::widgets::BorderType::Rounded)
        .border_style(Style::default().fg(BORDER_GRAY))
        .title(title)
        .title_style(Style::default().fg(TITLE_GRAY))
}

pub fn highlight_style() -> Style {
    Style::default()
        .fg(Color::Black)
        .bg(SPOTIFY_GREEN)
        .add_modifier(Modifier::BOLD)
}
