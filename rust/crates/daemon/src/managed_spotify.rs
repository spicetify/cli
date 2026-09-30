use std::path::Path;
use std::sync::{Arc, Mutex};

use crate::update_job::{Admission, AdmissionDisposition};
use anyhow::Context;
use serde::{Deserialize, Serialize};
use spicetify::commands::{guard, spotify};
use spicetify::context::{Config, SharedContext};

const STATE_FILE: &str = "managed-spotify-job.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case", rename_all_fields = "camelCase")]
pub enum Job {
    Idle,
    Running { job_id: String, phase: spotify::Phase },
    Complete { job_id: String },
    Failed { job_id: String, message: String },
}

impl Job {
    pub fn running(&self) -> bool {
        matches!(self, Self::Running { .. })
    }
}

#[derive(Debug, Clone)]
pub struct Handle {
    job: Arc<Mutex<Job>>,
    shared: Arc<SharedContext>,
}

#[derive(Debug, Serialize)]
pub struct Snapshot {
    installation: spotify::InstallationStatus,
    job: Job,
}

impl Handle {
    pub fn new(shared: Arc<SharedContext>) -> anyhow::Result<Self> {
        let root = shared.load().config_root.clone();
        let job = match std::fs::read(root.join(STATE_FILE)) {
            Ok(bytes) => recover_job(serde_json::from_slice(&bytes)?),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Job::Idle,
            Err(error) => return Err(error.into()),
        };
        persist(&root, &job)?;
        Ok(Self { job: Arc::new(Mutex::new(job)), shared })
    }

    pub fn snapshot(&self) -> anyhow::Result<Snapshot> {
        Ok(Snapshot {
            installation: spotify::installation_status(&self.shared.load_full()).unwrap_or_else(
                |error| spotify::InstallationStatus::Unavailable {
                    message: format!("Cannot inspect the current Spotify installation: {error:#}"),
                },
            ),
            job: self
                .job
                .lock()
                .map_err(|_| anyhow::anyhow!("managed update lock poisoned"))?
                .clone(),
        })
    }

    pub fn running(&self) -> bool {
        self.job.lock().is_ok_and(|job| job.running())
    }

    pub fn admit(&self) -> anyhow::Result<Admission> {
        let mut job =
            self.job.lock().map_err(|_| anyhow::anyhow!("managed update lock poisoned"))?;
        if let Job::Running { job_id, .. } = &*job {
            return Ok(Admission {
                job_id: job_id.clone(),
                disposition: AdmissionDisposition::Joined,
            });
        }
        let ctx = self.shared.load_full();
        let guard = guard::try_acquire(&ctx.config_root)?;
        anyhow::ensure!(
            matches!(
                spotify::installation_status(&ctx)?,
                spotify::InstallationStatus::Managed { .. }
            ),
            "Spotify is not managed by Spicetify; run `spicetify spotify install` first"
        );
        let job_id = format!(
            "{}-{}",
            std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)?.as_nanos()
        );
        let accepted = Job::Running { job_id: job_id.clone(), phase: spotify::Phase::Checking };
        persist(&ctx.config_root, &accepted)?;
        *job = accepted;
        let handle = self.clone();
        let id = job_id.clone();
        let spawned = std::thread::Builder::new().name("managed-spotify-update".into()).spawn(move || {
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                spotify::update_managed(&ctx, &guard, |phase| {
                    handle.publish(Job::Running { job_id: id.clone(), phase })
                })
            })).unwrap_or_else(|_| Err(anyhow::anyhow!("managed update worker panicked; run `spicetify spotify install` to repair the installation")));
            // Activation changes the configured installation. Refresh even after
            // an error: recovery may have restored the previous configuration.
            let refreshed = Config::load(&ctx.config_file)
                .and_then(|config| spicetify::context::AppContext::from_config(ctx.config_root.clone(), &config));
            let result = result.and_then(|()| refreshed.as_ref().map(|_| ()).map_err(|error| anyhow::anyhow!("cannot reload Spotify configuration: {error:#}")));
            if let Ok(next) = refreshed { handle.shared.store(next); }
            let terminal = match result {
                Ok(()) => Job::Complete { job_id: id },
                Err(error) => Job::Failed { job_id: id, message: format!("{error:#}") },
            };
            if let Err(error) = handle.publish(terminal) {
                tracing::error!(%error, "could not save managed Spotify update result");
            }
            drop(guard);
        });
        if let Err(error) = spawned {
            *job = Job::Failed { job_id, message: error.to_string() };
            persist(&self.shared.load().config_root, &job)?;
            return Err(error.into());
        }
        Ok(Admission { job_id, disposition: AdmissionDisposition::Accepted })
    }

    fn publish(&self, next: Job) -> anyhow::Result<()> {
        let mut job =
            self.job.lock().map_err(|_| anyhow::anyhow!("managed update lock poisoned"))?;
        let saved = persist(&self.shared.load().config_root, &next);
        *job = next;
        saved
    }
}

fn recover_job(job: Job) -> Job {
    match job {
        Job::Running { job_id, .. } => Job::Failed {
            job_id,
            message: "The daemon stopped during this update. Run `spicetify spotify install` to repair the installation, then retry.".into(),
        },
        other => other,
    }
}

fn persist(root: &Path, job: &Job) -> anyhow::Result<()> {
    use std::io::Write;
    let temporary = root.join("managed-spotify-job.json.tmp");
    let mut file = std::fs::File::create(&temporary)?;
    file.write_all(&serde_json::to_vec(job)?)?;
    file.sync_all()?;
    std::fs::rename(&temporary, root.join(STATE_FILE))
        .context("cannot save managed update progress")?;
    std::fs::File::open(root)?.sync_all()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restart_never_reports_an_interrupted_update_as_completed() {
        for phase in [
            spotify::Phase::Checking,
            spotify::Phase::Downloading,
            spotify::Phase::Preparing,
            spotify::Phase::Activating,
        ] {
            let restored = recover_job(Job::Running { job_id: "one".into(), phase });
            assert!(matches!(restored, Job::Failed { job_id, .. } if job_id == "one"));
        }
        assert!(matches!(
            recover_job(Job::Complete { job_id: "one".into() }),
            Job::Complete { .. }
        ));
    }
}
