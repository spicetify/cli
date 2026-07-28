use std::collections::VecDeque;

use spicetify::logging::LogLine;

#[derive(Debug, Clone)]
pub struct LogEntry {
    pub level: tracing::Level,
    pub message: String,
}

impl From<LogLine> for LogEntry {
    fn from(l: LogLine) -> Self {
        Self { level: l.level, message: l.message }
    }
}

impl From<String> for LogEntry {
    fn from(message: String) -> Self {
        Self { level: tracing::Level::INFO, message }
    }
}

#[derive(Debug)]
pub struct LogBuffer {
    entries: VecDeque<LogEntry>,
    capacity: usize,
}

impl LogBuffer {
    #[must_use]
    pub fn new(capacity: usize) -> Self {
        Self { entries: VecDeque::with_capacity(capacity), capacity }
    }

    pub fn push(&mut self, entry: impl Into<LogEntry>) {
        if self.entries.len() >= self.capacity {
            drop(self.entries.pop_front());
        }
        self.entries.push_back(entry.into());
    }

    pub fn tail(&self, n: usize) -> impl Iterator<Item = &LogEntry> {
        let start = self.entries.len().saturating_sub(n);
        self.entries.iter().skip(start)
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }
}
