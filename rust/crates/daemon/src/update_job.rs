use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock, mpsc};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use spicetify::commands::guard::DisruptiveOperationGuard;
use spicetify::context::{AppContext, Config, SharedContext};
use tokio::sync::oneshot;

const STATE_FILE: &str = "update-job.json";
const SCHEMA: u8 = 1;
const OFFER_TIMEOUT: Duration = Duration::from_mins(10);
const INSTALL_TIMEOUT: Duration = Duration::from_mins(30);
const SECURE_TIMEOUT: Duration = Duration::from_mins(2);
const SECURE_RETRY_INTERVAL: Duration = Duration::from_secs(10);
const TICK: Duration = Duration::from_secs(1);

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case", rename_all_fields = "camelCase")]
pub enum PublicJobStatus {
    Idle,
    Accepted {
        job_id: String,
        from_version: String,
    },
    WaitingForUpdate {
        job_id: String,
        from_version: String,
    },
    Downloading {
        job_id: String,
        target_version: String,
    },
    InstallingSpotify {
        job_id: String,
        target_version: String,
    },
    ApplyingSpicetify {
        job_id: String,
        target_version: String,
    },
    Securing {
        job_id: String,
        target_version: Option<String>,
        message: Option<String>,
        manual_recovery: bool,
    },
    Complete {
        job_id: String,
        from_version: String,
        to_version: String,
    },
    FailedSafe {
        job_id: String,
        code: FailureCode,
        message: String,
    },
}

impl PublicJobStatus {
    #[must_use]
    pub fn owns_recovery(&self) -> bool {
        !matches!(
            self,
            Self::Idle
                | Self::Complete { .. }
                | Self::FailedSafe { .. }
                | Self::Securing { manual_recovery: true, .. }
        )
    }
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FailureCode {
    UnsupportedPlatform,
    UnsupportedTarget,
    UpdateUnavailable,
    RendererTimeout,
    SpotifyUpdateFailed,
    ApplyFailed,
    SecuringFailed,
}

#[must_use]
pub const fn supported_on_this_platform() -> bool {
    cfg!(target_os = "macos")
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Admission {
    pub job_id: String,
    pub disposition: AdmissionDisposition,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AdmissionDisposition {
    Accepted,
    Joined,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case", rename_all_fields = "camelCase")]
pub enum RendererEvent {
    AcceptanceFlushed { job_id: String },
    Offered { job_id: String, target_version: String },
    Prepared { job_id: String, target_version: String },
    Applying { job_id: String, target_version: String },
    UpdateApiFailed { job_id: String, message: String },
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventAck {
    pub job_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "safety", rename_all = "snake_case")]
enum PersistedUpdateJob {
    Safe {
        schema: u8,
        id: String,
        from: String,
        supported_ceiling: String,
        accepted_at: u64,
        expires_at: u64,
    },
    Exposed {
        schema: u8,
        id: String,
        from: String,
        supported_ceiling: String,
        accepted_at: u64,
        expires_at: u64,
        target: Option<String>,
        phase: ExposedPhase,
        pending_outcome: Option<PendingOutcome>,
        last_error: Option<String>,
    },
    Terminal {
        schema: u8,
        id: String,
        outcome: TerminalOutcome,
    },
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum ExposedPhase {
    OpeningAperture,
    WaitingForOffer,
    Preparing,
    WaitingForReplacement,
    ApplyingSpicetify,
    Securing,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum PendingOutcome {
    Complete { from: String, to: String },
    FailedSafe { code: FailureCode, message: String },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum TerminalOutcome {
    Complete { from: String, to: String },
    FailedSafe { code: FailureCode, message: String },
    FailedUnsecured { code: FailureCode, message: String },
}

enum JobCommand {
    Admit { reply: oneshot::Sender<Result<Admission, String>> },
    Event { event: RendererEvent, reply: oneshot::Sender<Result<EventAck, String>> },
    AppsChanged,
    Shutdown { reply: oneshot::Sender<Result<(), String>> },
}

#[derive(Clone, Debug)]
pub struct UpdateJobHandle {
    tx: mpsc::Sender<JobCommand>,
    snapshot: Arc<RwLock<PublicJobStatus>>,
}

impl UpdateJobHandle {
    pub async fn admit(&self) -> Result<Admission, String> {
        let (tx, rx) = oneshot::channel();
        self.tx
            .send(JobCommand::Admit { reply: tx })
            .map_err(|_| "update supervisor stopped".to_string())?;
        rx.await.map_err(|_| "update supervisor stopped".to_string())?
    }

    pub async fn renderer_event(&self, event: RendererEvent) -> Result<EventAck, String> {
        let (tx, rx) = oneshot::channel();
        self.tx
            .send(JobCommand::Event { event, reply: tx })
            .map_err(|_| "update supervisor stopped".to_string())?;
        rx.await.map_err(|_| "update supervisor stopped".to_string())?
    }

    #[must_use]
    pub fn status(&self) -> PublicJobStatus {
        self.snapshot.read().unwrap_or_else(std::sync::PoisonError::into_inner).clone()
    }

    pub fn nudge_apps_changed(&self) {
        let _ = self.tx.send(JobCommand::AppsChanged);
    }

    pub async fn shutdown(&self) -> Result<(), String> {
        let (tx, rx) = oneshot::channel();
        self.tx
            .send(JobCommand::Shutdown { reply: tx })
            .map_err(|_| "update supervisor stopped".to_string())?;
        rx.await.map_err(|_| "update supervisor stopped".to_string())?
    }
}

pub fn spawn(shared: Arc<SharedContext>) -> UpdateJobHandle {
    let (tx, rx) = mpsc::channel();
    let snapshot = Arc::new(RwLock::new(PublicJobStatus::Idle));
    let handle = UpdateJobHandle { tx, snapshot: Arc::clone(&snapshot) };
    let _thread = std::thread::Builder::new()
        .name("spicetify-update-job".to_string())
        .spawn(move || Supervisor::new(shared, snapshot).run(&rx))
        .expect("update supervisor thread must start");
    handle
}

struct Supervisor {
    shared: Arc<SharedContext>,
    path: PathBuf,
    job: Option<PersistedUpdateJob>,
    snapshot: Arc<RwLock<PublicJobStatus>>,
    guard: Option<DisruptiveOperationGuard>,
    next_secure_retry: Option<Instant>,
}

impl Supervisor {
    fn new(shared: Arc<SharedContext>, snapshot: Arc<RwLock<PublicJobStatus>>) -> Self {
        let path = shared.load().config_root.join(STATE_FILE);
        Self { shared, path, job: None, snapshot, guard: None, next_secure_retry: None }
    }

    fn run(mut self, rx: &mpsc::Receiver<JobCommand>) {
        self.load_and_reconcile();
        let mut shutdown_reply = None;
        loop {
            match rx.recv_timeout(TICK) {
                Ok(JobCommand::Admit { reply }) => {
                    let _ = reply.send(self.admit());
                }
                Ok(JobCommand::Event { event, reply }) => {
                    let _ = reply.send(self.event(event));
                }
                Ok(JobCommand::AppsChanged) => self.check_install_facts(),
                Ok(JobCommand::Shutdown { reply }) => {
                    if self.is_active() {
                        self.secure_failure(
                            FailureCode::SpotifyUpdateFailed,
                            "daemon shutdown interrupted the Spotify update",
                        );
                    }
                    shutdown_reply = Some(reply);
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
                Err(mpsc::RecvTimeoutError::Timeout) => self.tick(),
            }
            if shutdown_reply.is_some() && !self.is_active() {
                let reply = shutdown_reply.take().expect("checked above");
                let _ = reply.send(Ok(()));
                break;
            }
        }
    }

    fn load_and_reconcile(&mut self) {
        match load_state(&self.path) {
            Ok(job) => self.job = job,
            Err(e) => {
                tracing::error!(error = %e, "update job state is corrupt; quarantining it and forcing the update block");
                quarantine(&self.path);
                if let Ok(ctx) = self.fresh_context() {
                    let _ = spicetify::commands::updates::set_blocked_temporarily(&ctx, true);
                }
            }
        }
        if self
            .job
            .as_mut()
            .is_some_and(|job| clamp_recovered_securing_deadline(job, securing_deadline()))
        {
            let _ = self.persist();
        }
        if self.is_active()
            && let Ok(ctx) = self.fresh_context()
        {
            self.guard = spicetify::commands::guard::try_acquire(&ctx.config_root).ok();
        }
        self.publish();

        if !supported_on_this_platform() && self.is_active() {
            let outcome = PendingOutcome::FailedSafe {
                code: FailureCode::UnsupportedPlatform,
                message: "Update & Apply is currently supported only on macOS".to_string(),
            };
            if self.guard.is_some() {
                tracing::warn!(
                    "recovering an update job on a platform where Update & Apply is unsupported"
                );
                self.secure(outcome);
            } else {
                if let Some(job) = self.job.as_mut() {
                    transition_to_securing(job, outcome, securing_deadline());
                }
                let _ = self.persist();
                self.publish();
                tracing::warn!(
                    "an unsupported-platform update job is waiting for the disruptive-operation lock before securing Spotify"
                );
            }
            return;
        }

        if self.is_active() && self.guard.is_none() {
            tracing::warn!(
                "an update job was recovered while another disruptive operation owns the lock; waiting before resuming"
            );
            return;
        }

        match self.job.as_ref() {
            Some(PersistedUpdateJob::Safe { .. } | PersistedUpdateJob::Terminal { .. }) | None => {}
            Some(PersistedUpdateJob::Exposed { phase: ExposedPhase::Securing, .. }) => {
                self.retry_securing();
            }
            Some(PersistedUpdateJob::Exposed { .. }) => {
                self.check_install_facts();
                if self.is_active() && !self.is_waiting_for_replacement() {
                    self.ensure_aperture_and_renderer();
                }
            }
        }
    }

    fn admit(&mut self) -> Result<Admission, String> {
        if !supported_on_this_platform() {
            return Err("Update & Apply is currently supported only on macOS".to_string());
        }
        if let Some(id) = self.active_id() {
            return Ok(Admission { job_id: id, disposition: AdmissionDisposition::Joined });
        }

        let ctx = self.fresh_context().map_err(|e| e.to_string())?;
        if ctx.mirror {
            return Err("Update & Apply is unavailable in mirror mode".to_string());
        }
        let evidence = admission_evidence(&ctx).map_err(|e| e.to_string())?;
        if version_line(&evidence.supported_ceiling) <= version_line(&evidence.installed) {
            return Err(format!(
                "no verified supported Spotify update is newer than {}",
                evidence.installed
            ));
        }
        let guard =
            spicetify::commands::guard::try_acquire(&ctx.config_root).map_err(|e| e.to_string())?;
        spicetify::commands::updates::preflight_mutation(&ctx).map_err(|e| {
            format!(
                "Spotify cannot be modified by the daemon. Allow Spicetify in System Settings > Privacy & Security > App Management, then retry: {e}"
            )
        })?;
        spicetify::commands::updates::persist_block_intent(&ctx).map_err(|e| e.to_string())?;

        let now = epoch_secs();
        let id = format!("{:x}-{:x}", epoch_nanos(), std::process::id());
        self.job = Some(PersistedUpdateJob::Safe {
            schema: SCHEMA,
            id: id.clone(),
            from: evidence.installed,
            supported_ceiling: evidence.supported_ceiling,
            accepted_at: now,
            expires_at: now + OFFER_TIMEOUT.as_secs(),
        });
        if let Err(e) = self.persist() {
            self.job = None;
            return Err(e.to_string());
        }
        self.guard = Some(guard);
        self.publish();
        Ok(Admission { job_id: id, disposition: AdmissionDisposition::Accepted })
    }

    fn event(&mut self, event: RendererEvent) -> Result<EventAck, String> {
        let event_id = match &event {
            RendererEvent::AcceptanceFlushed { job_id }
            | RendererEvent::Offered { job_id, .. }
            | RendererEvent::Prepared { job_id, .. }
            | RendererEvent::Applying { job_id, .. }
            | RendererEvent::UpdateApiFailed { job_id, .. } => job_id.clone(),
        };
        if self.active_id().as_deref() != Some(&event_id) {
            return Err("event does not belong to the active update job".to_string());
        }

        match event {
            RendererEvent::AcceptanceFlushed { .. } => self.open_aperture()?,
            RendererEvent::Offered { target_version, .. } => self.accept_offer(&target_version)?,
            RendererEvent::Prepared { target_version, .. } => {
                self.mark_prepared(&target_version)?;
            }
            RendererEvent::Applying { target_version, .. } => {
                self.mark_applying(&target_version)?;
            }
            RendererEvent::UpdateApiFailed { message, .. } => {
                self.secure(PendingOutcome::FailedSafe {
                    code: FailureCode::SpotifyUpdateFailed,
                    message,
                });
            }
        }
        Ok(EventAck { job_id: event_id })
    }

    fn open_aperture(&mut self) -> Result<(), String> {
        let Some(PersistedUpdateJob::Safe {
            schema, id, from, supported_ceiling, accepted_at, ..
        }) = self.job.clone()
        else {
            return Ok(());
        };
        self.job = Some(PersistedUpdateJob::Exposed {
            schema,
            id,
            from,
            supported_ceiling,
            accepted_at,
            expires_at: epoch_secs() + OFFER_TIMEOUT.as_secs(),
            target: None,
            phase: ExposedPhase::OpeningAperture,
            pending_outcome: None,
            last_error: None,
        });
        self.persist().map_err(|e| e.to_string())?;
        self.publish();
        self.ensure_aperture_and_renderer();
        Ok(())
    }

    fn ensure_aperture_and_renderer(&mut self) {
        let Ok(ctx) = self.fresh_context() else {
            self.secure_failure(
                FailureCode::SpotifyUpdateFailed,
                "cannot reload Spicetify configuration",
            );
            return;
        };
        if let Err(e) = spicetify::commands::updates::set_blocked_temporarily(&ctx, false) {
            self.secure_failure(
                FailureCode::SpotifyUpdateFailed,
                &format!("cannot temporarily allow Spotify updates: {e}"),
            );
            return;
        }
        if let Err(e) = spicetify::lifecycle::start(&ctx) {
            self.secure_failure(
                FailureCode::SpotifyUpdateFailed,
                &format!("cannot relaunch Spotify for its updater: {e}"),
            );
            return;
        }
        if let Some(PersistedUpdateJob::Exposed { phase, expires_at, .. }) = self.job.as_mut() {
            *phase = ExposedPhase::WaitingForOffer;
            *expires_at = epoch_secs() + OFFER_TIMEOUT.as_secs();
        }
        let _ = self.persist();
        self.publish();
    }

    fn accept_offer(&mut self, target: &str) -> Result<(), String> {
        let target_line = version_line(target)
            .ok_or_else(|| format!("Spotify offered malformed version {target}"))?;
        let Some(PersistedUpdateJob::Exposed {
            from,
            supported_ceiling,
            target: recorded,
            phase,
            expires_at,
            ..
        }) = self.job.as_mut()
        else {
            return Err("update job has not opened its updater aperture".to_string());
        };
        if let Some(existing) = recorded.as_deref() {
            if version_line(existing) != Some(target_line) {
                return Err(format!(
                    "active job already accepted Spotify {existing}, not {target}"
                ));
            }
            return Ok(());
        }
        let from_line = version_line(from)
            .ok_or_else(|| "installed Spotify version is malformed".to_string())?;
        let ceiling = version_line(supported_ceiling)
            .ok_or_else(|| "verified support ceiling is malformed".to_string())?;
        if target_line <= from_line || target_line > ceiling {
            let message = format!(
                "Spotify offered {target}, outside verified support ({from}..={supported_ceiling})"
            );
            self.secure(PendingOutcome::FailedSafe {
                code: FailureCode::UnsupportedTarget,
                message: message.clone(),
            });
            return Err(message);
        }
        *recorded = Some(target.to_string());
        *phase = ExposedPhase::Preparing;
        *expires_at = epoch_secs() + INSTALL_TIMEOUT.as_secs();
        self.persist().map_err(|e| e.to_string())?;
        self.publish();
        Ok(())
    }

    fn mark_prepared(&mut self, target: &str) -> Result<(), String> {
        self.require_target(target)?;
        if let Some(PersistedUpdateJob::Exposed { phase, expires_at, .. }) = self.job.as_mut() {
            *phase = ExposedPhase::Preparing;
            *expires_at = epoch_secs() + INSTALL_TIMEOUT.as_secs();
        }
        self.persist().map_err(|e| e.to_string())?;
        self.publish();
        Ok(())
    }

    fn mark_applying(&mut self, target: &str) -> Result<(), String> {
        self.require_target(target)?;
        if let Some(PersistedUpdateJob::Exposed { phase, expires_at, .. }) = self.job.as_mut() {
            *phase = ExposedPhase::WaitingForReplacement;
            *expires_at = epoch_secs() + INSTALL_TIMEOUT.as_secs();
        }
        self.persist().map_err(|e| e.to_string())?;
        self.publish();
        Ok(())
    }

    fn require_target(&self, target: &str) -> Result<(), String> {
        let recorded = match self.job.as_ref() {
            Some(PersistedUpdateJob::Exposed { target, .. }) => target.as_deref(),
            _ => None,
        };
        if recorded.is_some_and(|value| version_line(value) == version_line(target)) {
            Ok(())
        } else {
            Err(format!("Spotify update event target {target} was not acknowledged"))
        }
    }

    fn check_install_facts(&mut self) {
        if !self.is_active() || matches!(self.job, Some(PersistedUpdateJob::Safe { .. })) {
            return;
        }
        let Ok(ctx) = self.fresh_context() else { return };
        let advanced = self
            .installed_version()
            .and_then(|from| {
                spicetify::hooks::version_detect::detect_spotify_version(&ctx).ok().and_then(
                    |current| Some(version_line(&current.to_string())? > version_line(&from)?),
                )
            })
            .unwrap_or(false);
        if advanced {
            self.recover_and_apply(&ctx);
        }
    }

    fn recover_and_apply(&mut self, ctx: &AppContext) {
        let Some((from, target, supported_ceiling)) = self.expected_update() else {
            self.secure_failure(
                FailureCode::SpotifyUpdateFailed,
                "update job has no acknowledged Spotify target",
            );
            return;
        };
        let to = match spicetify::hooks::version_detect::detect_spotify_version(ctx) {
            Ok(version) => version.to_string(),
            Err(e) => {
                self.secure_failure(
                    FailureCode::SpotifyUpdateFailed,
                    &format!("cannot verify the installed Spotify version: {e}"),
                );
                return;
            }
        };
        let target_matches = match installed_update_status(&from, &target, &supported_ceiling, &to)
        {
            InstalledUpdateStatus::Expected => true,
            InstalledUpdateStatus::UnexpectedSupported => false,
            InstalledUpdateStatus::NotAdvanced | InstalledUpdateStatus::Malformed => {
                self.secure_failure(
                    FailureCode::SpotifyUpdateFailed,
                    &format!("Spotify did not advance from {from}; detected {to}"),
                );
                return;
            }
            InstalledUpdateStatus::AboveCeiling => {
                self.secure_failure(
                    FailureCode::UnsupportedTarget,
                    &format!(
                        "Spotify installed {to}, above the verified support ceiling {supported_ceiling}"
                    ),
                );
                return;
            }
        };

        if let Some(PersistedUpdateJob::Exposed { phase, .. }) = self.job.as_mut() {
            *phase = ExposedPhase::ApplyingSpicetify;
        }
        let _ = self.persist();
        self.publish();

        let Some(guard) = self.guard.as_ref() else {
            self.secure_failure(
                FailureCode::ApplyFailed,
                "update job lost its disruptive-operation guard before apply",
            );
            return;
        };
        if let Err(e) = spicetify::commands::apply::run(ctx, guard, false) {
            self.secure_failure(
                FailureCode::ApplyFailed,
                &format!("Spicetify apply failed after Spotify updated: {e}"),
            );
            return;
        }

        if !manifest_proves_apply(ctx, &to) {
            self.secure_failure(
                FailureCode::ApplyFailed,
                &format!("the staged manifest does not prove an apply for Spotify {to}"),
            );
            return;
        }
        if target_matches {
            self.secure(PendingOutcome::Complete { from, to });
        } else {
            self.secure_failure(
                FailureCode::SpotifyUpdateFailed,
                &format!("Spotify installed {to}, but the acknowledged target was {target}"),
            );
        }
    }

    fn secure_failure(&mut self, code: FailureCode, message: &str) {
        self.secure(PendingOutcome::FailedSafe { code, message: message.to_string() });
    }

    fn secure(&mut self, outcome: PendingOutcome) {
        if let Some(job) = self.job.as_mut() {
            transition_to_securing(job, outcome, securing_deadline());
        }
        self.next_secure_retry = None;
        let _ = self.persist();
        self.publish();
        self.retry_securing();
    }

    fn retry_securing(&mut self) {
        if self.next_secure_retry.is_some_and(|next| Instant::now() < next) {
            return;
        }
        let (outcome, expires_at) = match self.job.as_ref() {
            Some(PersistedUpdateJob::Exposed {
                phase: ExposedPhase::Securing,
                pending_outcome: Some(outcome),
                expires_at,
                ..
            }) => (outcome.clone(), *expires_at),
            _ => return,
        };
        let deadline_expired = epoch_secs() >= expires_at;
        let result = self.fresh_context().and_then(|ctx| {
            spicetify::commands::updates::set_blocked_temporarily(&ctx, true)?;
            if !spicetify::commands::updates::is_blocked(&ctx)? {
                anyhow::bail!("Spotify binary still exposes its update endpoint");
            }
            spicetify::lifecycle::start(&ctx)?;
            Ok(())
        });
        if let Err(e) = result {
            let failure = format!("could not restore the Spotify update block: {e}");
            if deadline_expired {
                self.finish_unsecured(Some(&failure));
                return;
            }
            if let Some(PersistedUpdateJob::Exposed { last_error, .. }) = self.job.as_mut() {
                *last_error = Some(failure);
            }
            self.next_secure_retry = Some(Instant::now() + SECURE_RETRY_INTERVAL);
            let _ = self.persist();
            self.publish();
            return;
        }

        let id = self.active_id().unwrap_or_default();
        let terminal = match outcome {
            PendingOutcome::Complete { from, to } => TerminalOutcome::Complete { from, to },
            PendingOutcome::FailedSafe { code, message } => {
                TerminalOutcome::FailedSafe { code, message }
            }
        };
        self.job = Some(PersistedUpdateJob::Terminal { schema: SCHEMA, id, outcome: terminal });
        let _ = self.persist();
        self.guard = None;
        self.next_secure_retry = None;
        self.publish();
    }

    fn finish_unsecured(&mut self, last_error: Option<&str>) {
        let id = self.active_id().unwrap_or_default();
        let detail = last_error.unwrap_or("the recovery step did not complete");
        self.job = Some(PersistedUpdateJob::Terminal {
            schema: SCHEMA,
            id,
            outcome: TerminalOutcome::FailedUnsecured {
                code: FailureCode::SecuringFailed,
                message: format!(
                    "Spotify's update block could not be restored before the recovery deadline: {detail}. Fix the reported error, then run `spicetify spotify-updates block`"
                ),
            },
        });
        let _ = self.persist();
        self.guard = None;
        self.next_secure_retry = None;
        self.publish();
    }

    fn tick(&mut self) {
        if self.is_active() && self.guard.is_none() {
            let Ok(ctx) = self.fresh_context() else { return };
            let Ok(guard) = spicetify::commands::guard::try_acquire(&ctx.config_root) else {
                return;
            };
            self.guard = Some(guard);
            match self.job.as_ref() {
                Some(PersistedUpdateJob::Exposed { phase: ExposedPhase::Securing, .. }) => {
                    self.retry_securing();
                }
                Some(PersistedUpdateJob::Exposed { .. }) => {
                    self.check_install_facts();
                    if self.is_active() && !self.is_waiting_for_replacement() {
                        self.ensure_aperture_and_renderer();
                    }
                }
                _ => {}
            }
            return;
        }
        match self.job.as_ref() {
            Some(PersistedUpdateJob::Exposed { phase: ExposedPhase::Securing, .. }) => {
                self.retry_securing();
                return;
            }
            Some(
                PersistedUpdateJob::Safe { expires_at, .. }
                | PersistedUpdateJob::Exposed { expires_at, .. },
            ) if epoch_secs() >= *expires_at => {
                let code = if matches!(self.job, Some(PersistedUpdateJob::Safe { .. })) {
                    FailureCode::RendererTimeout
                } else {
                    FailureCode::UpdateUnavailable
                };
                self.secure_failure(code, "Spotify's updater did not reach the next acknowledged phase before the deadline");
                return;
            }
            _ => {}
        }
        if self.is_waiting_for_replacement() {
            self.check_install_facts();
        }
    }

    fn persist(&self) -> anyhow::Result<()> {
        let Some(job) = self.job.as_ref() else { return Ok(()) };
        atomic_write_json(&self.path, job)
    }

    fn publish(&self) {
        let status = self.job.as_ref().map_or(PublicJobStatus::Idle, project_status);
        *self.snapshot.write().unwrap_or_else(std::sync::PoisonError::into_inner) = status;
    }

    fn fresh_context(&self) -> anyhow::Result<AppContext> {
        let base = self.shared.load_full();
        let cfg = Config::load(&base.config_file)?;
        AppContext::from_config(base.config_root.clone(), &cfg)
    }

    fn active_id(&self) -> Option<String> {
        match self.job.as_ref()? {
            PersistedUpdateJob::Safe { id, .. } | PersistedUpdateJob::Exposed { id, .. } => {
                Some(id.clone())
            }
            PersistedUpdateJob::Terminal { .. } => None,
        }
    }

    fn is_active(&self) -> bool {
        self.active_id().is_some()
    }

    fn is_waiting_for_replacement(&self) -> bool {
        matches!(
            self.job,
            Some(PersistedUpdateJob::Exposed {
                phase: ExposedPhase::WaitingForReplacement | ExposedPhase::ApplyingSpicetify,
                ..
            })
        )
    }

    fn installed_version(&self) -> Option<String> {
        match self.job.as_ref()? {
            PersistedUpdateJob::Safe { from, .. } | PersistedUpdateJob::Exposed { from, .. } => {
                Some(from.clone())
            }
            PersistedUpdateJob::Terminal {
                outcome: TerminalOutcome::Complete { from, .. },
                ..
            } => Some(from.clone()),
            PersistedUpdateJob::Terminal { .. } => None,
        }
    }

    fn expected_update(&self) -> Option<(String, String, String)> {
        match self.job.as_ref()? {
            PersistedUpdateJob::Exposed {
                from, target: Some(target), supported_ceiling, ..
            } => Some((from.clone(), target.clone(), supported_ceiling.clone())),
            _ => None,
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestEvidence {
    spotify_version: String,
    supported_spotify: Option<String>,
    classmap_verified: bool,
}

struct AdmissionEvidence {
    installed: String,
    supported_ceiling: String,
}

fn admission_evidence(ctx: &AppContext) -> anyhow::Result<AdmissionEvidence> {
    let manifest = read_manifest(ctx)?;
    if !manifest.classmap_verified {
        anyhow::bail!("the current classmap is not verified; refusing to update Spotify");
    }
    let supported_ceiling =
        manifest.supported_spotify.filter(|value| version_line(value).is_some()).ok_or_else(
            || anyhow::anyhow!("the applied manifest has no verified Spotify support ceiling"),
        )?;
    let installed = spicetify::hooks::version_detect::detect_spotify_version(ctx)?.to_string();
    if version_line(&manifest.spotify_version) != version_line(&installed) {
        anyhow::bail!(
            "the applied manifest is for Spotify {}, but {} is installed; run spicetify apply first",
            manifest.spotify_version,
            installed
        );
    }
    Ok(AdmissionEvidence { installed, supported_ceiling })
}

fn manifest_proves_apply(ctx: &AppContext, installed: &str) -> bool {
    read_manifest(ctx).is_ok_and(|manifest| manifest_matches_install(&manifest, installed))
}

fn manifest_matches_install(manifest: &ManifestEvidence, installed: &str) -> bool {
    let Some(installed) = version_line(installed) else {
        return false;
    };
    manifest.classmap_verified
        && version_line(&manifest.spotify_version) == Some(installed)
        && manifest
            .supported_spotify
            .as_deref()
            .and_then(version_line)
            .is_some_and(|supported| supported >= installed)
}

fn read_manifest(ctx: &AppContext) -> anyhow::Result<ManifestEvidence> {
    let path = ctx.dest_apps_path().join("xpui").join("modules").join("manifest.json");
    let raw = std::fs::read(&path)?;
    serde_json::from_slice(&raw)
        .map_err(|e| anyhow::anyhow!("cannot parse {}: {e}", path.display()))
}

fn project_status(job: &PersistedUpdateJob) -> PublicJobStatus {
    match job {
        PersistedUpdateJob::Safe { id, from, .. } => {
            PublicJobStatus::Accepted { job_id: id.clone(), from_version: from.clone() }
        }
        PersistedUpdateJob::Exposed { id, from, target, phase, last_error, .. } => match phase {
            ExposedPhase::OpeningAperture | ExposedPhase::WaitingForOffer => {
                PublicJobStatus::WaitingForUpdate { job_id: id.clone(), from_version: from.clone() }
            }
            ExposedPhase::Preparing => PublicJobStatus::Downloading {
                job_id: id.clone(),
                target_version: target.clone().unwrap_or_else(|| "unknown".to_string()),
            },
            ExposedPhase::WaitingForReplacement => PublicJobStatus::InstallingSpotify {
                job_id: id.clone(),
                target_version: target.clone().unwrap_or_else(|| "unknown".to_string()),
            },
            ExposedPhase::ApplyingSpicetify => PublicJobStatus::ApplyingSpicetify {
                job_id: id.clone(),
                target_version: target.clone().unwrap_or_else(|| "unknown".to_string()),
            },
            ExposedPhase::Securing => PublicJobStatus::Securing {
                job_id: id.clone(),
                target_version: target.clone(),
                message: last_error.clone(),
                manual_recovery: false,
            },
        },
        PersistedUpdateJob::Terminal { id, outcome, .. } => match outcome {
            TerminalOutcome::Complete { from, to } => PublicJobStatus::Complete {
                job_id: id.clone(),
                from_version: from.clone(),
                to_version: to.clone(),
            },
            TerminalOutcome::FailedSafe { code, message } => PublicJobStatus::FailedSafe {
                job_id: id.clone(),
                code: *code,
                message: message.clone(),
            },
            // Older Manager modules already render `securing.message`. Keep that
            // wire kind so a CLI-only upgrade cannot hide the recovery command.
            TerminalOutcome::FailedUnsecured { message, .. } => PublicJobStatus::Securing {
                job_id: id.clone(),
                target_version: None,
                message: Some(message.clone()),
                manual_recovery: true,
            },
        },
    }
}

fn version_line(raw: &str) -> Option<(u64, u64, u64)> {
    let mut parts = raw.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    let patch = parts.next()?.parse().ok()?;
    Some((major, minor, patch))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum InstalledUpdateStatus {
    Expected,
    UnexpectedSupported,
    NotAdvanced,
    AboveCeiling,
    Malformed,
}

fn installed_update_status(
    from: &str,
    target: &str,
    supported_ceiling: &str,
    installed: &str,
) -> InstalledUpdateStatus {
    let (Some(from), Some(target), Some(ceiling), Some(installed)) = (
        version_line(from),
        version_line(target),
        version_line(supported_ceiling),
        version_line(installed),
    ) else {
        return InstalledUpdateStatus::Malformed;
    };
    if installed <= from {
        InstalledUpdateStatus::NotAdvanced
    } else if installed > ceiling {
        InstalledUpdateStatus::AboveCeiling
    } else if installed == target {
        InstalledUpdateStatus::Expected
    } else {
        InstalledUpdateStatus::UnexpectedSupported
    }
}

fn epoch_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

fn epoch_nanos() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos()
}

fn load_state(path: &Path) -> anyhow::Result<Option<PersistedUpdateJob>> {
    match std::fs::read(path) {
        Ok(raw) => Ok(Some(serde_json::from_slice(&raw)?)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}

fn atomic_write_json(path: &Path, job: &PersistedUpdateJob) -> anyhow::Result<()> {
    let parent = path.parent().ok_or_else(|| anyhow::anyhow!("update job path has no parent"))?;
    std::fs::create_dir_all(parent)?;
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(job)?;
    let mut file =
        std::fs::OpenOptions::new().create(true).truncate(true).write(true).open(&tmp)?;
    std::io::Write::write_all(&mut file, &bytes)?;
    file.sync_all()?;
    replace_state_file(&tmp, path)?;
    #[cfg(not(windows))]
    sync_parent_dir(parent)?;
    Ok(())
}

#[cfg(not(windows))]
fn replace_state_file(tmp: &Path, path: &Path) -> std::io::Result<()> {
    std::fs::rename(tmp, path)
}

#[cfg(windows)]
fn replace_state_file(tmp: &Path, path: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;

    use windows::Win32::Storage::FileSystem::{
        MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH, MoveFileExW,
    };
    use windows::core::PCWSTR;

    let tmp: Vec<u16> = tmp.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    let path: Vec<u16> = path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    #[allow(unsafe_code)]
    unsafe {
        MoveFileExW(
            PCWSTR(tmp.as_ptr()),
            PCWSTR(path.as_ptr()),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
        .map_err(std::io::Error::other)
    }
}

#[cfg(not(windows))]
fn sync_parent_dir(parent: &Path) -> std::io::Result<()> {
    std::fs::File::open(parent)?.sync_all()
}

fn securing_deadline() -> u64 {
    epoch_secs() + SECURE_TIMEOUT.as_secs()
}

fn clamp_recovered_securing_deadline(job: &mut PersistedUpdateJob, deadline: u64) -> bool {
    let PersistedUpdateJob::Exposed { phase: ExposedPhase::Securing, expires_at, .. } = job else {
        return false;
    };
    if *expires_at <= deadline {
        return false;
    }
    *expires_at = deadline;
    true
}

fn transition_to_securing(job: &mut PersistedUpdateJob, outcome: PendingOutcome, deadline: u64) {
    match job {
        PersistedUpdateJob::Safe {
            schema,
            id,
            from,
            supported_ceiling,
            accepted_at,
            expires_at: _,
        } => {
            *job = PersistedUpdateJob::Exposed {
                schema: *schema,
                id: id.clone(),
                from: from.clone(),
                supported_ceiling: supported_ceiling.clone(),
                accepted_at: *accepted_at,
                expires_at: deadline,
                target: None,
                phase: ExposedPhase::Securing,
                pending_outcome: Some(outcome),
                last_error: None,
            };
        }
        PersistedUpdateJob::Exposed {
            phase,
            expires_at: current_expiry,
            pending_outcome,
            last_error,
            ..
        } => {
            let already_securing = *phase == ExposedPhase::Securing;
            *phase = ExposedPhase::Securing;
            if already_securing {
                *current_expiry = (*current_expiry).min(deadline);
                if pending_outcome.is_none() {
                    *pending_outcome = Some(outcome);
                }
            } else {
                *current_expiry = deadline;
                *pending_outcome = Some(outcome);
                *last_error = None;
            }
        }
        PersistedUpdateJob::Terminal { .. } => {}
    }
}

fn quarantine(path: &Path) {
    if !path.exists() {
        return;
    }
    let quarantine = path.with_extension(format!("corrupt-{}", epoch_secs()));
    if let Err(e) = std::fs::rename(path, &quarantine) {
        tracing::error!(error = %e, "could not quarantine corrupt update job state");
    }
}

#[cfg(test)]
#[path = "update_job_tests.rs"]
mod tests;
