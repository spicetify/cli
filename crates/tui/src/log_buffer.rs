use std::collections::VecDeque;

#[derive(Debug)]
pub struct LogBuffer {
    lines: VecDeque<String>,
    capacity: usize,
}

impl LogBuffer {
    #[must_use]
    pub fn new(capacity: usize) -> Self {
        Self { lines: VecDeque::with_capacity(capacity), capacity }
    }

    pub fn push(&mut self, line: String) {
        if self.lines.len() >= self.capacity {
            drop(self.lines.pop_front());
        }
        self.lines.push_back(line);
    }

    pub fn tail(&self, n: usize) -> impl Iterator<Item = &str> {
        let start = self.lines.len().saturating_sub(n);
        self.lines.iter().skip(start).map(String::as_str)
    }
}
