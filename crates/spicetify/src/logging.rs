// i dont think this is right?
// TODO: copy how codex does it
use std::sync::mpsc::{Receiver, Sender};

use anyhow::Result;
use tracing_subscriber::EnvFilter;
use tracing_subscriber::fmt::MakeWriter;
use tracing_subscriber::prelude::*;

#[derive(Debug, Clone)]
pub enum TuiEvent {
    Log(String),
    CommandFinished { success: bool },
}

pub type TuiEventSender = Sender<TuiEvent>;

pub type TuiEventReceiver = Receiver<TuiEvent>;

fn default_filter() -> EnvFilter {
    EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"))
}

pub fn init_for_tui(tx: &TuiEventSender) -> Result<()> {
    let writer = ChannelWriter { tx: tx.clone() };
    let layer = tracing_subscriber::fmt::layer()
        .with_writer(writer)
        .with_target(false)
        .with_level(true)
        .without_time();
    tracing_subscriber::registry()
        .with(default_filter())
        .with(layer)
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

struct ChannelWriter {
    tx: TuiEventSender,
}

impl std::io::Write for ChannelWriter {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let s = String::from_utf8_lossy(buf);
        let trimmed = s.trim_end_matches(['\n', '\r']);
        if !trimmed.is_empty() && self.tx.send(TuiEvent::Log(trimmed.to_string())).is_err() {
            return Err(std::io::Error::new(std::io::ErrorKind::BrokenPipe, "receiver dropped"));
        }
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl<'a> MakeWriter<'a> for ChannelWriter {
    type Writer = ChannelWriter;

    fn make_writer(&'a self) -> Self::Writer {
        ChannelWriter { tx: self.tx.clone() }
    }
}
