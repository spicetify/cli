use super::*;

fn fixture_root(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "spicetify-update-job-{label}-{}-{}",
        std::process::id(),
        epoch_nanos()
    ))
}

fn safe_job() -> PersistedUpdateJob {
    PersistedUpdateJob::Safe {
        schema: SCHEMA,
        id: "job".to_string(),
        from: "1.2.97".to_string(),
        supported_ceiling: "1.2.99".to_string(),
        accepted_at: 1,
        expires_at: 2,
    }
}

fn exposed_job() -> PersistedUpdateJob {
    PersistedUpdateJob::Exposed {
        schema: SCHEMA,
        id: "job".to_string(),
        from: "1.2.97".to_string(),
        supported_ceiling: "1.2.99".to_string(),
        accepted_at: 1,
        expires_at: u64::MAX,
        target: None,
        phase: ExposedPhase::WaitingForOffer,
        pending_outcome: None,
        last_error: None,
    }
}

fn supervisor_with(job: PersistedUpdateJob, root: &Path) -> Supervisor {
    let ctx =
        AppContext::from_config(root.to_path_buf(), &Config::default()).expect("fixture context");
    let snapshot = Arc::new(RwLock::new(PublicJobStatus::Idle));
    let mut supervisor = Supervisor::new(Arc::new(SharedContext::new(ctx)), snapshot);
    supervisor.job = Some(job);
    supervisor
}

#[test]
fn spotify_lines_ignore_the_build_component() {
    assert_eq!(version_line("1.2.97.42"), Some((1, 2, 97)));
    assert_eq!(version_line("1.2.97"), Some((1, 2, 97)));
    assert!(version_line("UNKNOWN").is_none());
}

#[test]
fn update_and_apply_support_matches_the_compiled_platform() {
    assert_eq!(
        supported_on_this_platform(),
        cfg!(target_os = "macos") || cfg!(all(windows, feature = "experimental-windows-updates"))
    );
}

#[cfg(not(any(target_os = "macos", all(windows, feature = "experimental-windows-updates"))))]
#[test]
fn unsupported_platform_refuses_admission_before_mutating_state() {
    let root = fixture_root("unsupported-platform");
    let mut supervisor = supervisor_with(safe_job(), &root);
    supervisor.job = None;

    let error = supervisor.admit().expect_err("non-macOS admission must fail closed");

    assert!(error.contains("only on macOS"));
    assert!(supervisor.job.is_none());
}

#[test]
fn installed_version_must_match_the_acknowledged_supported_target() {
    assert_eq!(
        installed_update_status("1.2.97", "1.2.99.1", "1.2.99", "1.2.99.2"),
        InstalledUpdateStatus::Expected
    );
    assert_eq!(
        installed_update_status("1.2.97", "1.2.98", "1.2.99", "1.2.99"),
        InstalledUpdateStatus::UnexpectedSupported
    );
    assert_eq!(
        installed_update_status("1.2.97", "1.2.99", "1.2.99", "1.2.100"),
        InstalledUpdateStatus::AboveCeiling
    );
    assert_eq!(
        installed_update_status("1.2.97", "1.2.99", "1.2.99", "1.2.97"),
        InstalledUpdateStatus::NotAdvanced
    );
}

#[test]
fn terminal_completion_projects_all_three_facts() {
    let status = project_status(&PersistedUpdateJob::Terminal {
        schema: SCHEMA,
        id: "job".to_string(),
        outcome: TerminalOutcome::Complete { from: "1.2.94".to_string(), to: "1.2.97".to_string() },
    });
    assert!(matches!(
        &status,
        PublicJobStatus::Complete { from_version, to_version, .. }
            if from_version == "1.2.94" && to_version == "1.2.97"
    ));
}

#[test]
fn safe_failure_enters_retryable_securing_state() {
    let mut job = safe_job();
    transition_to_securing(
        &mut job,
        PendingOutcome::FailedSafe {
            code: FailureCode::RendererTimeout,
            message: "renderer timed out".to_string(),
        },
        123,
    );

    assert!(matches!(
        job,
        PersistedUpdateJob::Exposed {
            phase: ExposedPhase::Securing,
            expires_at: 123,
            target: None,
            pending_outcome: Some(PendingOutcome::FailedSafe {
                code: FailureCode::RendererTimeout,
                ..
            }),
            ..
        }
    ));
}

#[test]
fn terminal_unsecured_failure_is_not_reported_as_safe() {
    let status = project_status(&PersistedUpdateJob::Terminal {
        schema: SCHEMA,
        id: "job".to_string(),
        outcome: TerminalOutcome::FailedUnsecured {
            code: FailureCode::SecuringFailed,
            message: "run the recovery command".to_string(),
        },
    });

    assert!(matches!(
        &status,
        PublicJobStatus::Securing {
            message: Some(message),
            manual_recovery: true,
            ..
        } if message == "run the recovery command"
    ));
    assert!(!status.owns_recovery());
    let wire = serde_json::to_value(&status).expect("serialize public status");
    assert_eq!(wire.get("kind").and_then(serde_json::Value::as_str), Some("securing"));
    assert_eq!(wire.get("manualRecovery").and_then(serde_json::Value::as_bool), Some(true));
    assert_eq!(
        wire.get("message").and_then(serde_json::Value::as_str),
        Some("run the recovery command")
    );
}

#[test]
fn repeated_securing_transitions_never_extend_the_deadline() {
    let mut job = exposed_job();
    transition_to_securing(
        &mut job,
        PendingOutcome::FailedSafe {
            code: FailureCode::ApplyFailed,
            message: "first failure".to_string(),
        },
        100,
    );
    transition_to_securing(
        &mut job,
        PendingOutcome::FailedSafe {
            code: FailureCode::RendererTimeout,
            message: "later failure".to_string(),
        },
        200,
    );

    assert!(matches!(
        job,
        PersistedUpdateJob::Exposed {
            phase: ExposedPhase::Securing,
            expires_at: 100,
            pending_outcome: Some(PendingOutcome::FailedSafe {
                code: FailureCode::ApplyFailed,
                ..
            }),
            ..
        }
    ));
}

#[test]
fn recovered_legacy_securing_deadline_is_only_clamped_down() {
    let mut job = exposed_job();
    transition_to_securing(
        &mut job,
        PendingOutcome::FailedSafe {
            code: FailureCode::ApplyFailed,
            message: "apply failed".to_string(),
        },
        1_000,
    );

    assert!(clamp_recovered_securing_deadline(&mut job, 200));
    assert!(!clamp_recovered_securing_deadline(&mut job, 500));
    assert!(matches!(job, PersistedUpdateJob::Exposed { expires_at: 200, .. }));
}

#[test]
fn acknowledged_renderer_events_advance_to_replacement_wait() {
    let root = fixture_root("renderer-transitions");
    let mut supervisor = supervisor_with(exposed_job(), &root);

    supervisor.accept_offer("1.2.99.123").expect("supported offer");
    assert!(matches!(
        project_status(supervisor.job.as_ref().expect("active job")),
        PublicJobStatus::Downloading { target_version, .. } if target_version == "1.2.99.123"
    ));

    supervisor.mark_prepared("1.2.99.456").expect("same three-part target");
    supervisor.mark_applying("1.2.99.789").expect("same three-part target");
    assert!(matches!(
        project_status(supervisor.job.as_ref().expect("active job")),
        PublicJobStatus::InstallingSpotify { target_version, .. }
            if target_version == "1.2.99.123"
    ));
    assert!(supervisor.require_target("1.2.100").is_err());

    std::fs::remove_dir_all(root).expect("cleanup transition fixture");
}

#[test]
fn manifest_requires_verified_compatible_classmap() {
    let mut manifest = ManifestEvidence {
        spotify_version: "1.2.99.7".to_string(),
        supported_spotify: Some("1.2.99".to_string()),
        classmap_verified: true,
    };
    assert!(manifest_matches_install(&manifest, "1.2.99.9"));

    manifest.classmap_verified = false;
    assert!(!manifest_matches_install(&manifest, "1.2.99.9"));
    manifest.classmap_verified = true;
    manifest.supported_spotify = Some("1.2.98".to_string());
    assert!(!manifest_matches_install(&manifest, "1.2.99.9"));
    manifest.supported_spotify = Some("1.2.99".to_string());
    assert!(!manifest_matches_install(&manifest, "1.2.100"));
}

#[test]
fn atomic_state_write_can_replace_an_existing_job() {
    let root = fixture_root("write");
    let path = root.join(STATE_FILE);
    let first = safe_job();
    atomic_write_json(&path, &first).expect("first state write");

    let second = PersistedUpdateJob::Terminal {
        schema: SCHEMA,
        id: "job".to_string(),
        outcome: TerminalOutcome::FailedSafe {
            code: FailureCode::RendererTimeout,
            message: "renderer timed out".to_string(),
        },
    };
    atomic_write_json(&path, &second).expect("replacement state write");

    assert!(matches!(
        load_state(&path).expect("read state"),
        Some(PersistedUpdateJob::Terminal {
            outcome: TerminalOutcome::FailedSafe { code: FailureCode::RendererTimeout, .. },
            ..
        })
    ));
    std::fs::remove_dir_all(root).expect("cleanup state fixture");
}
