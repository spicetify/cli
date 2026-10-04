use std::path::{Path, PathBuf};
use std::process::{Command, Output};

use super::*;

#[derive(Debug)]
struct Fixture {
    root: PathBuf,
    ctx: AppContext,
}

impl Fixture {
    fn new(name: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "spicetify-macos-{name}-{}-{}",
            std::process::id(),
            SystemTime::now().duration_since(UNIX_EPOCH).expect("clock").as_nanos()
        ));
        let binary = root.join("Spotify.app/Contents/MacOS/Spotify");
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
        Self { root, ctx }
    }

    fn signed_bundle(&self) -> PathBuf {
        let bundle = self.root.join("Spotify.app");
        let helper = bundle.join("Contents/Frameworks/Fixture Helper.app");
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
            let binary = app.join("Contents/MacOS/Spotify");
            std::fs::create_dir_all(binary.parent().expect("parent")).expect("helper");
            std::fs::write(
                app.join("Contents/Info.plist"),
                format!(
                    "<?xml version=\"1.0\"?><plist version=\"1.0\"><dict>\
                    <key>CFBundleIdentifier</key><string>{identifier}</string>\
                    <key>CFBundleExecutable</key><string>Spotify</string>\
                    <key>CFBundlePackageType</key><string>APPL</string>\
                    </dict></plist>"
                ),
            )
            .expect("Info.plist");
            let mut compiler = Command::new("/usr/bin/clang");
            let _ = compiler.arg(&source).arg("-o").arg(&binary);
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
    flags: String,
    runtime: String,
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
        .expect("signature flags")
        .to_string();
    let runtime = display
        .lines()
        .find_map(|line| line.strip_prefix("Runtime Version="))
        .expect("runtime version")
        .to_string();
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
            let output = successful(&mut Command::new(app.join("Contents/MacOS/Spotify")));
            assert!(String::from_utf8_lossy(&output.stdout).contains("JIT result: 42"));
        }
    }
}
