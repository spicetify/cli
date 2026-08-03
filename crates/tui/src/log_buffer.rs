use std::collections::VecDeque;

use spicetify::logging::LogLine;

#[derive(Debug)]
pub(crate) struct LogBuffer {
    entries: VecDeque<LogLine>,
    capacity: usize,
}

impl LogBuffer {
    #[must_use]
    pub(crate) fn new(capacity: usize) -> Self {
        Self { entries: VecDeque::with_capacity(capacity), capacity }
    }

    pub(crate) fn push(&mut self, entry: impl Into<LogLine>) {
        if self.entries.len() >= self.capacity {
            drop(self.entries.pop_front());
        }
        self.entries.push_back(entry.into());
    }

    pub(crate) fn tail(&self, n: usize) -> impl Iterator<Item = &LogLine> {
        let start = self.entries.len().saturating_sub(n);
        self.entries.iter().skip(start)
    }

    #[must_use]
    pub(crate) fn len(&self) -> usize {
        self.entries.len()
    }

    pub(crate) fn clear(&mut self) {
        self.entries.clear();
    }
}
