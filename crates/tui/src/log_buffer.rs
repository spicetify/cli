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
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(msg: &str) -> LogEntry {
        LogEntry { level: tracing::Level::INFO, message: msg.to_string() }
    }

    #[test]
    fn push_within_capacity() {
        let mut buf = LogBuffer::new(3);
        buf.push(entry("a"));
        buf.push(entry("b"));
        assert_eq!(buf.len(), 2);
        let tail: Vec<_> = buf.tail(10).map(|e| &*e.message).collect();
        assert_eq!(tail, vec!["a", "b"]);
    }

    #[test]
    fn push_exceeds_capacity_evicts_oldest() {
        let mut buf = LogBuffer::new(2);
        buf.push(entry("a"));
        buf.push(entry("b"));
        buf.push(entry("c"));
        assert_eq!(buf.len(), 2);
        let tail: Vec<_> = buf.tail(10).map(|e| &*e.message).collect();
        assert_eq!(tail, vec!["b", "c"]);
    }

    #[test]
    fn tail_asks_more_than_len() {
        let mut buf = LogBuffer::new(10);
        buf.push(entry("a"));
        let tail: Vec<_> = buf.tail(5).map(|e| &*e.message).collect();
        assert_eq!(tail, vec!["a"]);
    }

    #[test]
    fn tail_asks_exact_count() {
        let mut buf = LogBuffer::new(10);
        buf.push(entry("a"));
        buf.push(entry("b"));
        buf.push(entry("c"));
        let tail: Vec<_> = buf.tail(2).map(|e| &*e.message).collect();
        assert_eq!(tail, vec!["b", "c"]);
    }

    #[test]
    fn tail_asks_zero() {
        let mut buf = LogBuffer::new(10);
        buf.push(entry("a"));
        let tail: Vec<_> = buf.tail(0).collect::<Vec<_>>();
        assert!(tail.is_empty());
    }

    #[test]
    fn empty_buffer() {
        let buf = LogBuffer::new(10);
        assert_eq!(buf.len(), 0);
        let tail: Vec<_> = buf.tail(5).collect::<Vec<_>>();
        assert!(tail.is_empty());
    }
}
