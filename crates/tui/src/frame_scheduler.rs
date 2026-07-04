use std::time::{Duration, Instant};

use tokio::sync::{broadcast, mpsc};

const MIN_INTERVAL: Duration = Duration::from_nanos(8_333_333);

#[derive(Clone, Debug)]
pub(crate) struct FrameRequester {
    tx: mpsc::UnboundedSender<Instant>,
}

impl FrameRequester {
    pub(crate) fn new(draw_tx: broadcast::Sender<()>) -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        let scheduler = FrameScheduler { rx, draw_tx, limiter: FrameRateLimiter::default() };
        let _ = tokio::spawn(scheduler.run());
        Self { tx }
    }

    pub(crate) fn schedule(&self) {
        let _ = self.tx.send(Instant::now());
    }
}

struct FrameScheduler {
    rx: mpsc::UnboundedReceiver<Instant>,
    draw_tx: broadcast::Sender<()>,
    limiter: FrameRateLimiter,
}

impl FrameScheduler {
    async fn run(mut self) {
        const ONE_YEAR: Duration = Duration::from_hours(8760);
        let mut next: Option<Instant> = None;
        loop {
            // dont draw if no scheduled
            // same way codex does
            let target = next.unwrap_or_else(|| Instant::now() + ONE_YEAR);
            let deadline = tokio::time::sleep_until(target.into());
            tokio::pin!(deadline);

            tokio::select! {
                draw_at = self.rx.recv() => {
                    let Some(draw_at) = draw_at else { break };
                    let clamped = self.limiter.clamp(draw_at);
                    next = Some(next.map_or(clamped, |cur| cur.min(clamped)));
                }
                () = &mut deadline => {
                    if next.is_some() {
                        next = None;
                        self.limiter.record(target);
                        let _ = self.draw_tx.send(());
                    }
                }
            }
        }
    }
}

#[derive(Debug, Default)]
struct FrameRateLimiter {
    last: Option<Instant>,
}

impl FrameRateLimiter {
    fn clamp(&self, requested: Instant) -> Instant {
        let Some(last) = self.last else { return requested };
        let earliest = last.checked_add(MIN_INTERVAL).unwrap_or(last);
        requested.max(earliest)
    }

    fn record(&mut self, emitted: Instant) {
        self.last = Some(emitted);
    }
}
