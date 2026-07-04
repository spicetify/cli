#![feature(junction_point)]

pub mod commands;
pub mod context;
pub mod daemon;
pub mod error;
pub use i18n_embed_fl;
pub mod lifecycle;
pub mod locale;
pub mod logging;
pub(crate) mod module;
pub mod platform;
pub mod process;
pub mod update;
pub(crate) mod util;
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
