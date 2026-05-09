use std::{
    collections::VecDeque, sync::{Mutex, OnceLock}
};

struct CaptureState {
    enabled: bool,
    lines: Vec<String>,
    stream: Option<std::sync::mpsc::Sender<String>>,
}

fn capture_state() -> &'static Mutex<CaptureState> {
    static STATE: OnceLock<Mutex<CaptureState>> = OnceLock::new();
    STATE.get_or_init(|| {
        Mutex::new(CaptureState {
            enabled: false,
            lines: Vec::new(),
            stream: None,
        })
    })
}

pub fn capture_begin(stream: std::sync::mpsc::Sender<String>) {
    if let Ok(mut state) = capture_state().lock() {
        state.enabled = true;
        state.lines.clear();
        state.stream = Some(stream);
    }
}

pub fn capture_end() -> Vec<String> {
    if let Ok(mut state) = capture_state().lock() {
        state.enabled = false;
        state.stream = None;
        std::mem::take(&mut state.lines)
    } else {
        Vec::new()
    }
}

pub fn info(msg: &str) {
    emit("INFO", "36", msg);
}

pub fn warn(msg: &str) {
    emit("WARN", "33", msg);
}

pub fn error(msg: &str) {
    emit("ERROR", "31", msg);
}

pub fn fatal(msg: &str) {
    emit("FATAL", "31;1", msg);
}

fn emit(level: &str, ansi: &str, msg: &str) {
    if let Ok(mut state) = capture_state().lock() {
        if state.enabled {
            let line = format!("{level} {msg}");
            state.lines.push(line.clone());
            if let Some(stream) = &state.stream {
                let _ = stream.send(line);
            }
            return;
        }
    }
    eprintln!("\x1b[{ansi}m{level}\x1b[0m {msg}");
}

pub struct LogBuffer {
    buf: VecDeque<String>,
    cap: usize,
}

impl LogBuffer {
    pub fn new(cap: usize) -> Self {
        Self {
            buf: VecDeque::with_capacity(cap),
            cap,
        }
    }

    pub fn push(&mut self, line: String) {
        if self.buf.len() >= self.cap {
            self.buf.pop_front();
        }
        self.buf.push_back(line);
    }

    pub fn tail(&self, n: usize) -> impl Iterator<Item = &String> {
        let skip = self.buf.len().saturating_sub(n);
        self.buf.iter().skip(skip)
    }

    pub fn len(&self) -> usize {
        self.buf.len()
    }
}
