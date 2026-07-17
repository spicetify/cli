// i dont think this is right?
// TODO: copy how codex does it
use std::fmt;
use std::sync::mpsc::{Receiver, Sender};

use anyhow::Result;
use tracing::Level;
use tracing_subscriber::EnvFilter;
use tracing_subscriber::layer::Layer;
use tracing_subscriber::prelude::*;

#[derive(Debug, Clone)]
pub struct LogLine {
    pub level: Level,
    pub message: String,
}

#[derive(Debug, Clone)]
pub enum TuiEvent {
    Log(LogLine),
    CommandFinished { success: bool },
}

pub type TuiEventSender = Sender<TuiEvent>;

pub type TuiEventReceiver = Receiver<TuiEvent>;

fn default_filter() -> EnvFilter {
    EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"))
}

pub fn init_for_tui(tx: &TuiEventSender) -> Result<()> {
    let layer = TuiLogLayer { tx: tx.clone() };
    tracing_subscriber::registry()
        .with(default_filter())
        .with(layer)
        .try_init()
        .map_err(|e| anyhow::anyhow!("{e}"))?;
    Ok(())
}

pub fn init_for_file(path: &std::path::Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| anyhow::anyhow!("failed to open log file {}: {e}", path.display()))?;
    tracing_subscriber::fmt()
        .with_env_filter(default_filter())
        .with_target(true)
        .with_writer(std::sync::Mutex::new(file))
        .try_init()
        .map_err(|e| anyhow::anyhow!("{e}"))?;
    Ok(())
}
pub fn init_for_cli() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(default_filter())
        .with_target(false)
        .without_time()
        .try_init()
        .map_err(|e| anyhow::anyhow!("{e}"))?;
    Ok(())
}

struct TuiLogLayer {
    tx: TuiEventSender,
}

impl<S> Layer<S> for TuiLogLayer
where
    S: tracing::Subscriber,
{
    fn on_event(
        &self,
        event: &tracing::Event<'_>,
        _ctx: tracing_subscriber::layer::Context<'_, S>,
    ) {
        let mut visitor = MessageVisitor::default();
        event.record(&mut visitor);
        let message = visitor.into_message();
        let _ = self.tx.send(TuiEvent::Log(LogLine { level: *event.metadata().level(), message }));
    }
}

#[derive(Default)]
struct MessageVisitor {
    message: Option<String>,
}

impl MessageVisitor {
    fn into_message(self) -> String {
        self.message.unwrap_or_default()
    }
}

impl tracing::field::Visit for MessageVisitor {
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn fmt::Debug) {
        if field.name() == "message" {
            self.message = Some(format!("{value:?}"));
        }
    }

    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if field.name() == "message" {
            self.message = Some(value.to_string());
        }
    }
}
