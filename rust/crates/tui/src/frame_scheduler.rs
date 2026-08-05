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
        drop(tokio::spawn(scheduler.run()));
        Self { tx }
    }

    pub(crate) fn schedule(&self) {
        if let Err(e) = self.tx.send(Instant::now()) {
            tracing::warn!(error = %e, "frame scheduler channel closed");
        }
    }

    pub(crate) fn schedule_in(&self, dur: Duration) {
        if let Err(e) = self.tx.send(Instant::now() + dur) {
            tracing::warn!(error = %e, "frame scheduler channel closed");
        }
    }
}

struct FrameScheduler {
    rx: mpsc::UnboundedReceiver<Instant>,
    draw_tx: broadcast::Sender<()>,
    limiter: FrameRateLimiter,
}

impl FrameScheduler {
    async fn run(mut self) {
        let mut next: Option<Instant> = None;
        loop {
            let target = next;
            let sleep = async {
                match target {
                    Some(t) => tokio::time::sleep_until(t.into()).await,
                    None => std::future::pending::<()>().await,
                }
            };
            tokio::pin!(sleep);

            tokio::select! {
                draw_at = self.rx.recv() => {
                    let Some(draw_at) = draw_at else { break };
                    let clamped = self.limiter.clamp(draw_at);
                    next = Some(next.map_or(clamped, |cur| cur.min(clamped)));
                }
                () = &mut sleep => {
                    if let Some(t) = next.take() {
                        self.limiter.record(t);
                        if let Err(e) = self.draw_tx.send(()) {
                            tracing::warn!(error = %e, "draw broadcast channel closed");
                            break;
                        }
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
