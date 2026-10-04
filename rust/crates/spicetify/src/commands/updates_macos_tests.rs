use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use super::super::*;
use super::{atomic_replace_binary, migration_backup};

#[derive(Debug)]
struct Fixture {
    root: PathBuf,
    ctx: AppContext,
}

impl Fixture {
    fn new(name: &str) -> Self {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).expect("clock").as_nanos();
        let root = std::env::temp_dir()
            .canonicalize()
            .expect("temporary root")
            .join(format!("spicetify-macos-{name}-{}-{nonce}", std::process::id()));
        let binary =
            root.join("Spotify.app/Contents/MacOS").join(format!("spfx{}", nonce % 10_000_000_000));
        let resources = root.join("Spotify.app/Contents/Resources");
        std::fs::create_dir_all(binary.parent().expect("binary parent")).expect("bundle");
        std::fs::create_dir_all(&resources).expect("resources");
        std::fs::write(&binary, b"unmodified client without an update endpoint")
            .expect("executable");
        let cfg = crate::context::Config {
            spotify_exec: Some(binary),
            spotify_data_dir: Some(resources),
            offline_bnk_dir: Some(root.join("profile/PersistentCache")),
            ..Default::default()
        };
        let ctx = AppContext::from_config(root.join("config"), &cfg).expect("context");
        cfg.save(&ctx.config_file).expect("fixture configuration");
        Self { root, ctx }
    }

    fn signed_bundle(&self) -> PathBuf {
        let bundle = self.root.join("Spotify.app");
        let helper = bundle.join("Contents/Frameworks/Fixture Helper.app");
        let executable = self
            .ctx
            .spotify_exec
            .file_name()
            .and_then(|name| name.to_str())
            .expect("fixture executable");
        let source = self.root.join("jit.c");
        std::fs::write(&source, include_str!("fixtures/macos-signing.c")).expect("C fixture");
        for (app, identifier, entitlements, runtime) in [
            (
                &helper,
                "org.spicetify.fixture.helper",
                "<key>com.apple.security.cs.allow-jit</key><true/>",
                "26.1.0",
            ),
            (
                &bundle,
                "org.spicetify.fixture",
                concat!(
                    "<key>com.apple.security.cs.allow-jit</key><true/>",
                    "<key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>",
                    "<key>com.apple.security.cs.disable-executable-page-protection</key><true/>",
                    "<key>com.apple.security.cs.disable-library-validation</key><true/>"
                ),
                "26.2.0",
            ),
        ] {
            let binary = app.join("Contents/MacOS").join(executable);
            std::fs::create_dir_all(binary.parent().expect("parent")).expect("helper");
            std::fs::write(
                app.join("Contents/Info.plist"),
                format!(
                    "<?xml version=\"1.0\"?><plist version=\"1.0\"><dict>\
                    <key>CFBundleIdentifier</key><string>{identifier}</string>\
                    <key>CFBundleExecutable</key><string>{executable}</string>\
                    <key>CFBundlePackageType</key><string>APPL</string>\
                    </dict></plist>"
                ),
            )
            .expect("Info.plist");
            let mut compiler = Command::new("/usr/bin/clang");
            let _ = compiler
                .arg(&source)
                .arg("-arch")
                .arg(if cfg!(target_arch = "aarch64") { "arm64" } else { "x86_64" })
                .arg("-o")
                .arg(&binary);
            if cfg!(target_arch = "aarch64") {
                let _ = compiler.arg("-DSPICETIFY_ARM64");
            }
            let _ = successful(&mut compiler);
            let entitlement_file = self.root.join(format!("{identifier}.plist"));
            std::fs::write(
                &entitlement_file,
                format!(
                    "<?xml version=\"1.0\"?><plist version=\"1.0\"><dict>{entitlements}</dict></plist>"
                ),
            )
            .expect("entitlements");
            let _ = successful(
                Command::new("/usr/bin/codesign")
                    .args(["--force", "--sign", "-", "--options", "runtime", "--runtime-version"])
                    .arg(runtime)
                    .arg("--entitlements")
                    .arg(&entitlement_file)
                    .arg(app),
            );
        }
        bundle
    }

    fn signed_legacy_bundle(&self) -> PathBuf {
        let bundle = self.signed_bundle();
        let mut binary = std::fs::read(&self.ctx.spotify_exec).expect("signed executable");
        assert!(patch_update_endpoint(&mut binary, true));
        std::fs::write(&self.ctx.spotify_exec, binary).expect("legacy endpoint");
        codesign_bundle(&self.ctx.spotify_exec).expect("signed legacy endpoint");
        bundle
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        for path in [self.root.join("profile/Update"), self.ctx.offline_bnk_dir.join("Update")] {
            if path.is_dir() {
                match Command::new("/usr/bin/chflags").arg("nouchg").arg(&path).output() {
                    Ok(output) if output.status.success() => {}
                    result => eprintln!("Could not unlock fixture {}: {result:?}", path.display()),
                }
            }
        }
        if let Err(error) = std::fs::remove_dir_all(&self.root) {
            eprintln!("Could not remove fixture {}: {error}", self.root.display());
        }
    }
}

fn successful(command: &mut Command) -> Output {
    let output = command.output().expect("execute fixture tool");
    assert!(output.status.success(), "{command:?}: {output:?}");
    output
}

#[derive(Debug, PartialEq, Eq)]
struct SigningMetadata {
    flags: u32,
    runtime: Option<String>,
    entitlements: Vec<u8>,
}

fn signing_metadata(bundle: &Path) -> SigningMetadata {
    let display = successful(
        Command::new("/usr/bin/codesign").args(["--display", "--verbose=4"]).arg(bundle),
    );
    let display = String::from_utf8(display.stderr).expect("signature display");
    let flags = display
        .split_whitespace()
        .find(|field| field.starts_with("flags="))
        .expect("signature flags");
    let flags =
        flags.strip_prefix("flags=0x").expect("hex flags").split('(').next().expect("flags value");
    let flags = u32::from_str_radix(flags, 16).expect("signature flags value") & !2;
    let runtime =
        display.lines().find_map(|line| line.strip_prefix("Runtime Version=")).map(str::to_string);
    let entitlements = successful(
        Command::new("/usr/bin/codesign").args(["--display", "--entitlements", ":-"]).arg(bundle),
    )
    .stdout;
    SigningMetadata { flags, runtime, entitlements }
}

#[test]
fn resigning_preserves_each_executables_runtime_metadata_and_jit_after_repeated_signing() {
    let fixture = Fixture::new("signing");
    let bundle = fixture.signed_bundle();
    let helper = bundle.join("Contents/Frameworks/Fixture Helper.app");
    let main_before = signing_metadata(&bundle);
    let helper_before = signing_metadata(&helper);
    assert!(main_before.flags & 0x0001_0000 != 0, "fixture has Hardened Runtime");
    assert!(main_before.runtime.is_some(), "fixture has runtime metadata");
    assert_ne!(main_before.entitlements, helper_before.entitlements);
    assert_ne!(main_before.runtime, helper_before.runtime);

    for _ in 0..2 {
        std::fs::write(bundle.join("Contents/Resources/changed.txt"), b"modified resources")
            .expect("modify sealed resources");
        codesign_bundle(&fixture.ctx.spotify_exec).expect("actual signing helper");
        let _ = successful(
            Command::new("/usr/bin/codesign").args(["--verify", "--deep", "--strict"]).arg(&bundle),
        );
        assert_eq!(signing_metadata(&bundle), main_before, "main executable metadata");
        assert_eq!(signing_metadata(&helper), helper_before, "nested executable metadata");
        for app in [&bundle, &helper] {
            let executable = fixture.ctx.spotify_exec.file_name().expect("fixture executable");
            let output = successful(&mut Command::new(app.join("Contents/MacOS").join(executable)));
            assert!(String::from_utf8_lossy(&output.stdout).contains("JIT result: 42"));
        }
    }
}

#[test]
fn directory_block_prevents_staging_and_reverses_without_changing_the_executable() {
    let fixture = Fixture::new("directories");
    let original = std::fs::read(&fixture.ctx.spotify_exec).expect("original executable");
    let current = fixture.root.join("profile/Update");
    let legacy = fixture.ctx.offline_bnk_dir.join("Update");
    assert!(!is_blocked(&fixture.ctx).expect("known unblocked state without endpoint"));

    set_blocked(&fixture.ctx, true).expect("directory-only block");
    set_blocked(&fixture.ctx, true).expect("idempotent block");
    assert!(is_blocked(&fixture.ctx).expect("physical protection"));
    for directory in [&current, &legacy] {
        assert!(std::fs::write(directory.join("download"), b"new update").is_err());
        assert!(std::fs::remove_dir(directory).is_err(), "cannot remove a protected directory");
        assert!(std::fs::rename(directory, directory.with_extension("old")).is_err());
    }
    std::fs::write(fixture.root.join("profile/unrelated-cache"), b"unrelated")
        .expect("other cache remains writable");
    assert_eq!(std::fs::read(&fixture.ctx.spotify_exec).expect("unchanged executable"), original);

    set_blocked(&fixture.ctx, false).expect("unblock");
    set_blocked(&fixture.ctx, false).expect("idempotent unblock");
    assert!(!is_blocked(&fixture.ctx).expect("physical protection removed"));
    for directory in [&current, &legacy] {
        std::fs::write(directory.join("download"), b"update").expect("staging writable again");
    }
    assert_eq!(std::fs::read(&fixture.ctx.spotify_exec).expect("unchanged executable"), original);
}

struct RunningFixture(std::process::Child);

impl Drop for RunningFixture {
    fn drop(&mut self) {
        if self.0.try_wait().ok().flatten().is_none()
            && let Err(error) = self.0.kill()
        {
            eprintln!("Could not stop fixture child {}: {error}", self.0.id());
        }
        if let Err(error) = self.0.wait() {
            eprintln!("Could not reap fixture child {}: {error}", self.0.id());
        }
    }
}

#[test]
fn no_op_policy_changes_preserve_the_running_client_but_transitions_stop_it() {
    for blocked in [false, true] {
        let fixture = Fixture::new("no-op");
        set_blocked_temporarily(&fixture.ctx, blocked).expect("prepare policy");
        let _ =
            std::fs::copy("/bin/sleep", &fixture.ctx.spotify_exec).expect("stand-in executable");
        let mut running = RunningFixture(
            Command::new(&fixture.ctx.spotify_exec).arg("60").spawn().expect("stand-in process"),
        );
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        while !crate::lifecycle::is_running(&fixture.ctx) && std::time::Instant::now() < deadline {
            std::thread::sleep(std::time::Duration::from_millis(25));
        }
        assert!(crate::lifecycle::is_running(&fixture.ctx), "stand-in started");
        set_blocked_temporarily(&fixture.ctx, blocked).expect("no-op");
        assert!(running.0.try_wait().expect("child status").is_none(), "same child survives");
        set_blocked_temporarily(&fixture.ctx, !blocked).expect("real transition");
        assert!(running.0.try_wait().expect("stopped child status").is_some());
    }
}

#[test]
fn unrequested_or_explicitly_allowed_policies_do_not_adopt_protection() {
    for (intent, legacy) in [(None, false), (Some(false), false), (Some(false), true)] {
        let fixture = Fixture::new("allow-intent");
        let mut ctx = fixture.ctx.clone();
        ctx.block_spotify_updates = intent;
        let mut cfg = crate::context::Config::load(&ctx.config_file).expect("configuration");
        cfg.block_spotify_updates = intent;
        cfg.save(&ctx.config_file).expect("intent");
        if legacy {
            std::fs::write(&ctx.spotify_exec, ENDPOINT_BLOCKED).expect("legacy endpoint");
        }
        let original = std::fs::read(&ctx.spotify_exec).expect("original executable");
        reassert_block(&ctx);
        assert_eq!(std::fs::read(&ctx.spotify_exec).expect("unchanged executable"), original);
        assert!(!fixture.root.join("profile/Update").exists());
        assert!(!ctx.offline_bnk_dir.join("Update").exists());
        assert_eq!(
            crate::context::Config::load(&ctx.config_file)
                .expect("intent remains")
                .block_spotify_updates,
            intent
        );
    }
}

#[test]
fn blocking_discards_prepared_updates_but_preserves_unrelated_cache_files() {
    let fixture = Fixture::new("prepared");
    let current = fixture.root.join("profile/Update");
    let legacy = fixture.ctx.offline_bnk_dir.join("Update");
    for directory in [&current, &legacy] {
        std::fs::create_dir_all(directory.join("temp/Spotify.app")).expect("prepared bundle");
        std::fs::write(directory.join("update.json"), b"prepared").expect("prepared metadata");
        std::fs::write(directory.join("temp/Spotify.app/client"), b"prepared executable")
            .expect("prepared executable");
    }
    let unrelated = fixture.root.join("profile/Users/user-data");
    std::fs::create_dir_all(unrelated.parent().expect("parent")).expect("user cache");
    std::fs::write(&unrelated, b"keep").expect("unrelated cache");
    set_blocked(&fixture.ctx, true).expect("block prepared update");
    for directory in [&current, &legacy] {
        assert_eq!(std::fs::read_dir(directory).expect("empty staging").count(), 0);
    }
    assert_eq!(std::fs::read(unrelated).expect("user cache survives"), b"keep");
}

#[test]
fn adopts_legacy_directory_intent_and_reasserts_the_current_directory_protection() {
    let fixture = Fixture::new("adopt");
    let legacy = fixture.ctx.offline_bnk_dir.join("Update");
    std::fs::create_dir_all(&legacy).expect("legacy staging");
    let _ = successful(Command::new("/usr/bin/chflags").arg("uchg").arg(&legacy));
    assert!(!is_blocked(&fixture.ctx).expect("legacy-only protection is incomplete"));
    reassert_block(&fixture.ctx);
    assert!(is_blocked(&fixture.ctx).expect("both directories protected"));
    assert_eq!(
        crate::context::Config::load(&fixture.ctx.config_file)
            .expect("remembered intent")
            .block_spotify_updates,
        Some(true)
    );
    set_blocked_temporarily(&fixture.ctx, false).expect("open update aperture");
    assert!(!is_blocked(&fixture.ctx).expect("aperture open"));
    assert_eq!(
        crate::context::Config::load(&fixture.ctx.config_file)
            .expect("durable intent")
            .block_spotify_updates,
        Some(true)
    );
    let mut ctx = fixture.ctx.clone();
    ctx.block_spotify_updates = Some(true);
    reassert_block(&ctx);
    assert!(is_blocked(&ctx).expect("protection reasserted"));
}

#[test]
fn restores_a_legacy_endpoint_patch_after_securing_directories_and_preserves_signing_metadata() {
    let fixture = Fixture::new("migration");
    let bundle = fixture.signed_bundle();
    let metadata = signing_metadata(&bundle);
    let mut binary = std::fs::read(&fixture.ctx.spotify_exec).expect("signed executable");
    assert!(patch_update_endpoint(&mut binary, true));
    std::fs::write(&fixture.ctx.spotify_exec, &binary).expect("legacy patch");
    codesign_bundle(&fixture.ctx.spotify_exec).expect("legacy signature");
    assert!(is_blocked(&fixture.ctx).expect("legacy physical block recognized"));

    reassert_block(&fixture.ctx);
    let restored = std::fs::read(&fixture.ctx.spotify_exec).expect("migrated executable");
    assert!(contains(&restored, ENDPOINT_LIVE.as_bytes()));
    assert!(!contains(&restored, ENDPOINT_BLOCKED.as_bytes()));
    assert!(is_blocked(&fixture.ctx).expect("directories remain protected"));
    assert_eq!(signing_metadata(&bundle), metadata);
    let _ = successful(
        Command::new("/usr/bin/codesign").args(["--verify", "--deep", "--strict"]).arg(&bundle),
    );
    let output = successful(&mut Command::new(&fixture.ctx.spotify_exec));
    assert!(String::from_utf8_lossy(&output.stdout).contains(ENDPOINT_LIVE));
    assert!(String::from_utf8_lossy(&output.stdout).contains("JIT result: 42"));

    set_blocked(&fixture.ctx, false).expect("unblock migrated client");
    set_blocked(&fixture.ctx, true).expect("reblock migrated client");
    assert_eq!(
        std::fs::read(&fixture.ctx.spotify_exec).expect("no further binary mutation"),
        restored
    );
}

#[test]
fn a_partial_staging_write_preserves_the_installed_image_and_allows_retry() {
    use std::io::Write;
    use std::os::unix::fs::PermissionsExt;

    let fixture = Fixture::new("partial-write");
    let bundle = fixture.signed_legacy_bundle();
    let original = std::fs::read(&fixture.ctx.spotify_exec).expect("signed original");
    let permissions =
        std::fs::metadata(&fixture.ctx.spotify_exec).expect("metadata").permissions().mode();
    let metadata = signing_metadata(&bundle);
    let backup = migration_backup(&fixture.ctx.spotify_exec).expect("backup path");
    std::fs::hard_link(&fixture.ctx.spotify_exec, &backup).expect("on-disk recovery image");
    let mut restored = original.clone();
    assert!(patch_update_endpoint(&mut restored, false));
    let result = atomic_replace_binary(&fixture.ctx.spotify_exec, &restored, |file, bytes| {
        file.write_all(bytes.get(..3).expect("executable prefix"))?;
        Err(std::io::Error::other("injected partial write failure"))
    });
    assert!(result.is_err());
    assert_eq!(
        std::fs::read(&fixture.ctx.spotify_exec).expect("installed image survives"),
        original
    );
    assert_eq!(std::fs::read(&backup).expect("recovery image survives"), original);
    let _ = successful(
        Command::new("/usr/bin/codesign").args(["--verify", "--deep", "--strict"]).arg(&bundle),
    );
    set_blocked_temporarily(&fixture.ctx, true).expect("retry migration");
    assert!(!backup.exists(), "completed migration removes recovery image");
    assert_eq!(signing_metadata(&bundle), metadata);
    assert_eq!(
        std::fs::metadata(&fixture.ctx.spotify_exec).expect("metadata").permissions().mode(),
        permissions
    );
    assert!(is_blocked(&fixture.ctx).expect("retry secures staging"));
}

#[test]
fn interrupted_migration_is_retried_even_after_the_blocked_endpoint_is_gone() {
    for missing_image in [false, true] {
        let fixture = Fixture::new("interrupted-migration");
        let bundle = fixture.signed_legacy_bundle();
        let original = std::fs::read(&fixture.ctx.spotify_exec).expect("signed original");
        let metadata = signing_metadata(&bundle);
        let backup = migration_backup(&fixture.ctx.spotify_exec).expect("backup path");
        std::fs::hard_link(&fixture.ctx.spotify_exec, &backup).expect("recovery image");
        let mut restored = original;
        assert!(patch_update_endpoint(&mut restored, false));
        atomic_replace_binary(&fixture.ctx.spotify_exec, &restored, std::io::Write::write_all)
            .expect("replacement before interruption");
        assert!(
            !Command::new("/usr/bin/codesign")
                .args(["--verify", "--deep", "--strict"])
                .arg(&bundle)
                .status()
                .expect("invalid signature check")
                .success()
        );
        if missing_image {
            std::fs::remove_file(&fixture.ctx.spotify_exec)
                .expect("interrupted signer removed image");
        }
        set_blocked_temporarily(&fixture.ctx, true).expect("recover interrupted migration");
        assert!(!backup.exists());
        assert_eq!(signing_metadata(&bundle), metadata);
        let _ = successful(
            Command::new("/usr/bin/codesign").args(["--verify", "--deep", "--strict"]).arg(&bundle),
        );
        let output = successful(&mut Command::new(&fixture.ctx.spotify_exec));
        assert!(String::from_utf8_lossy(&output.stdout).contains("JIT result: 42"));
    }
}

#[test]
fn a_legacy_signed_client_can_open_and_close_the_temporary_aperture_without_changing_intent() {
    let fixture = Fixture::new("legacy-aperture");
    let bundle = fixture.signed_legacy_bundle();
    let metadata = signing_metadata(&bundle);
    let helper = bundle.join("Contents/Frameworks/Fixture Helper.app");
    let helper_metadata = signing_metadata(&helper);
    let mut cfg = crate::context::Config::load(&fixture.ctx.config_file).expect("configuration");
    cfg.block_spotify_updates = Some(true);
    cfg.save(&fixture.ctx.config_file).expect("durable block");
    set_blocked_temporarily(&fixture.ctx, false).expect("open legacy aperture");
    assert!(!is_blocked(&fixture.ctx).expect("aperture open"));
    let migrated = std::fs::read(&fixture.ctx.spotify_exec).expect("restored endpoint");
    assert!(contains(&migrated, ENDPOINT_LIVE.as_bytes()));
    assert!(!contains(&migrated, ENDPOINT_BLOCKED.as_bytes()));
    set_blocked_temporarily(&fixture.ctx, true).expect("close aperture");
    assert!(is_blocked(&fixture.ctx).expect("physical block restored"));
    assert_eq!(std::fs::read(&fixture.ctx.spotify_exec).expect("no repeated migration"), migrated);
    assert_eq!(signing_metadata(&bundle), metadata);
    assert_eq!(signing_metadata(&helper), helper_metadata);
    let _ = successful(
        Command::new("/usr/bin/codesign").args(["--verify", "--deep", "--strict"]).arg(&bundle),
    );
    assert_eq!(
        crate::context::Config::load(&fixture.ctx.config_file)
            .expect("durable intent")
            .block_spotify_updates,
        Some(true)
    );
}

#[test]
fn failed_legacy_resigning_leaves_directory_protection_and_original_binary_in_place() {
    let fixture = Fixture::new("migration-failure");
    let original = format!("not a Mach-O executable: {ENDPOINT_BLOCKED}").into_bytes();
    std::fs::write(&fixture.ctx.spotify_exec, &original).expect("unusable legacy bundle");
    assert!(set_blocked(&fixture.ctx, true).is_err(), "failed migration must be reported");
    assert_eq!(std::fs::read(&fixture.ctx.spotify_exec).expect("rollback executable"), original);
    for directory in
        [fixture.root.join("profile/Update"), fixture.ctx.offline_bnk_dir.join("Update")]
    {
        assert!(
            std::fs::write(directory.join("download"), b"update").is_err(),
            "migration failure stays blocked"
        );
    }
    assert!(
        set_blocked(&fixture.ctx, false).is_err(),
        "cannot open aperture with failed migration"
    );
    assert!(is_blocked(&fixture.ctx).expect("physical protection retained"));
}

#[test]
fn rejects_redirected_or_invalid_staging_paths_without_changing_their_targets() {
    use std::os::unix::fs::symlink;

    let fixture = Fixture::new("redirected");
    let target = fixture.root.join("unrelated");
    std::fs::create_dir_all(&target).expect("unrelated directory");
    std::fs::create_dir_all(fixture.root.join("profile")).expect("profile");
    symlink(&target, fixture.root.join("profile/Update")).expect("redirected staging");
    assert!(set_blocked(&fixture.ctx, true).is_err());
    assert!(is_blocked(&fixture.ctx).is_err());
    std::fs::write(target.join("user-file"), b"keep").expect("target remains writable");
    assert!(
        !fixture.ctx.offline_bnk_dir.join("Update").exists(),
        "validate all paths before mutating"
    );
}

#[test]
fn partial_protection_is_not_reported_blocked_and_missing_executables_do_not_prevent_unblocking() {
    let fixture = Fixture::new("partial");
    set_blocked(&fixture.ctx, true).expect("block");
    let current = fixture.root.join("profile/Update");
    let _ = successful(Command::new("/usr/bin/chflags").arg("nouchg").arg(&current));
    assert!(!is_blocked(&fixture.ctx).expect("partial protection"));
    set_blocked(&fixture.ctx, true).expect("repair partial protection");
    std::fs::remove_file(&fixture.ctx.spotify_exec).expect("client replaced");
    assert!(is_blocked(&fixture.ctx).expect("protection independent of executable"));
    set_blocked(&fixture.ctx, false).expect("unblock missing client");
    assert!(!is_blocked(&fixture.ctx).expect("known unblocked state"));
}

#[test]
fn a_prepared_update_is_not_reported_blocked_even_when_its_parent_is_immutable() {
    let fixture = Fixture::new("ready");
    set_blocked(&fixture.ctx, true).expect("block");
    let current = fixture.root.join("profile/Update");
    let _ = successful(Command::new("/usr/bin/chflags").arg("nouchg").arg(&current));
    std::fs::write(current.join("update.json"), b"ready").expect("prepared update");
    let _ = successful(Command::new("/usr/bin/chflags").arg("uchg").arg(&current));
    assert!(!is_blocked(&fixture.ctx).expect("prepared update can still be installed"));
    let mut ctx = fixture.ctx.clone();
    ctx.block_spotify_updates = Some(true);
    reassert_block(&ctx);
    assert!(is_blocked(&ctx).expect("ready update discarded and protection restored"));
}

#[test]
fn directory_protection_does_not_write_or_resign_a_clean_read_only_executable() {
    use std::os::unix::fs::PermissionsExt;

    let fixture = Fixture::new("read-only");
    let bundle = fixture.signed_bundle();
    let before = std::fs::read(&fixture.ctx.spotify_exec).expect("signed executable");
    let metadata = signing_metadata(&bundle);
    std::fs::set_permissions(&fixture.ctx.spotify_exec, std::fs::Permissions::from_mode(0o444))
        .expect("read-only executable");
    set_blocked(&fixture.ctx, true).expect("directory protection with read-only executable");
    set_blocked(&fixture.ctx, false).expect("unblock with read-only executable");
    assert_eq!(std::fs::read(&fixture.ctx.spotify_exec).expect("unchanged executable"), before);
    assert_eq!(signing_metadata(&bundle), metadata);
    let _ = successful(
        Command::new("/usr/bin/codesign").args(["--verify", "--deep", "--strict"]).arg(&bundle),
    );
}

#[test]
fn admission_probes_locking_without_opening_the_existing_aperture_or_leaving_probe_directories() {
    let fixture = Fixture::new("preflight");
    set_blocked(&fixture.ctx, true).expect("block");
    preflight_mutation(&fixture.ctx).expect("admission probe");
    assert!(is_blocked(&fixture.ctx).expect("existing protection retained"));
    for parent in [
        fixture.root.join("profile"),
        fixture.ctx.offline_bnk_dir.clone(),
        fixture.ctx.spotify_apps_path(),
    ] {
        for entry in std::fs::read_dir(parent).expect("probe parent") {
            assert!(
                !entry
                    .expect("entry")
                    .file_name()
                    .to_string_lossy()
                    .starts_with(".spicetify-update-preflight-")
            );
        }
    }
}

#[test]
fn a_directory_permission_failure_is_reported_without_claiming_full_protection() {
    use std::os::unix::fs::PermissionsExt;

    let fixture = Fixture::new("permission");
    std::fs::create_dir_all(&fixture.ctx.offline_bnk_dir).expect("persistent cache");
    std::fs::set_permissions(&fixture.ctx.offline_bnk_dir, std::fs::Permissions::from_mode(0o555))
        .expect("unwritable legacy parent");
    let result = set_blocked_and_remember(&fixture.ctx, true);
    std::fs::set_permissions(&fixture.ctx.offline_bnk_dir, std::fs::Permissions::from_mode(0o755))
        .expect("restore fixture permissions");
    assert!(result.is_err(), "partial protection must not succeed");
    assert!(!is_blocked(&fixture.ctx).expect("partial protection is not blocked"));
    assert_eq!(
        crate::context::Config::load(&fixture.ctx.config_file)
            .expect("durable request")
            .block_spotify_updates,
        Some(true)
    );
}

#[test]
fn clearing_staging_removes_links_without_deleting_their_targets() {
    use std::os::unix::fs::symlink;

    let fixture = Fixture::new("staged-links");
    let unrelated = fixture.root.join("unrelated-data");
    std::fs::create_dir_all(&unrelated).expect("unrelated directory");
    std::fs::write(unrelated.join("user-file"), b"keep").expect("unrelated file");
    let current = fixture.root.join("profile/Update");
    std::fs::create_dir_all(&current).expect("staging");
    symlink(&unrelated, current.join("download")).expect("staged link");
    set_blocked(&fixture.ctx, true).expect("clear and protect staging");
    assert_eq!(std::fs::read(unrelated.join("user-file")).expect("link target survives"), b"keep");
    assert!(is_blocked(&fixture.ctx).expect("no prepared update remains"));
}

fn macho_files(root: &Path) -> Vec<PathBuf> {
    use std::io::Read;

    let mut files = Vec::new();
    for entry in std::fs::read_dir(root).expect("bundle tree") {
        let entry = entry.expect("bundle entry");
        let path = entry.path();
        let kind = entry.file_type().expect("bundle entry type");
        if kind.is_dir() {
            files.extend(macho_files(&path));
        } else if kind.is_file() {
            let mut magic = [0; 4];
            let mut file = std::fs::File::open(&path).expect("bundle file");
            if file.read(&mut magic).expect("Mach-O header") == 4
                && matches!(
                    magic,
                    [0xfe, 0xed, 0xfa, 0xce | 0xcf]
                        | [0xce | 0xcf, 0xfa, 0xed, 0xfe]
                        | [0xca, 0xfe, 0xba, 0xbe | 0xbf]
                        | [0xbe | 0xbf, 0xba, 0xfe, 0xca]
                )
            {
                files.push(path);
            }
        }
    }
    files.sort();
    files
}

#[test]
#[ignore = "requires SPICETIFY_SIGNING_BUNDLE pointing to a pristine official Spotify.app"]
fn finalizes_a_private_copy_of_a_real_spotify_bundle_without_losing_runtime_metadata() {
    let source = std::env::var_os("SPICETIFY_SIGNING_BUNDLE").expect("official Spotify.app source");
    let source = Path::new(&source);
    let _ = successful(
        Command::new("/usr/bin/codesign").args(["--verify", "--deep", "--strict"]).arg(source),
    );
    let fixture = Fixture::new("official");
    let bundle = fixture.root.join("Official.app");
    let _ = successful(Command::new("/bin/cp").arg("-R").arg(source).arg(&bundle));
    let files = macho_files(&bundle);
    assert!(files.len() > 1, "include nested code, not just the main executable");
    let before: Vec<_> = files.iter().map(|file| signing_metadata(file)).collect();
    assert!(before.iter().any(|metadata| metadata.flags & 0x0001_0000 != 0));
    let mut ctx = fixture.ctx.clone();
    ctx.spotify_exec = bundle.join("Contents/MacOS/Spotify");
    ctx.spotify_data_dir = bundle.join("Contents/Resources");
    for _ in 0..2 {
        std::fs::write(
            bundle.join("Contents/Resources/spicetify-signing-test"),
            b"modified resources",
        )
        .expect("modified sealed resources");
        finalize_app_signature(&ctx).expect(
            "actual finalization helper, strict signature verification, and Gatekeeper policy",
        );
        assert_eq!(macho_files(&bundle), files, "same nested code tree");
        for (file, metadata) in files.iter().zip(&before) {
            assert_eq!(&signing_metadata(file), metadata, "metadata of {}", file.display());
        }
    }
    let _ = successful(
        Command::new("/usr/bin/codesign").args(["--verify", "--deep", "--strict"]).arg(source),
    );
}
