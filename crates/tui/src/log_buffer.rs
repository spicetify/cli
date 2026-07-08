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

    pub fn len(&self) -> usize {
        self.lines.len()
    }

    pub fn is_empty(&self) -> bool {
        self.lines.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_within_capacity() {
        let mut buf = LogBuffer::new(3);
        buf.push("a".into());
        buf.push("b".into());
        assert_eq!(buf.len(), 2);
        let tail: Vec<_> = buf.tail(10).collect();
        assert_eq!(tail, vec!["a", "b"]);
    }

    #[test]
    fn push_exceeds_capacity_evicts_oldest() {
        let mut buf = LogBuffer::new(2);
        buf.push("a".into());
        buf.push("b".into());
        buf.push("c".into());
        assert_eq!(buf.len(), 2);
        let tail: Vec<_> = buf.tail(10).collect();
        assert_eq!(tail, vec!["b", "c"]);
    }

    #[test]
    fn tail_asks_more_than_len() {
        let mut buf = LogBuffer::new(10);
        buf.push("a".into());
        let tail: Vec<_> = buf.tail(5).collect();
        assert_eq!(tail, vec!["a"]);
    }

    #[test]
    fn tail_asks_exact_count() {
        let mut buf = LogBuffer::new(10);
        buf.push("a".into());
        buf.push("b".into());
        buf.push("c".into());
        let tail: Vec<_> = buf.tail(2).collect();
        assert_eq!(tail, vec!["b", "c"]);
    }

    #[test]
    fn tail_asks_zero() {
        let mut buf = LogBuffer::new(10);
        buf.push("a".into());
        let tail: Vec<_> = buf.tail(0).collect();
        assert!(tail.is_empty());
    }

    #[test]
    fn empty_buffer() {
        let buf = LogBuffer::new(10);
        assert_eq!(buf.len(), 0);
        let tail: Vec<_> = buf.tail(5).collect();
        assert!(tail.is_empty());
    }
}
