#![allow(unused_crate_dependencies)]

use std::process::Command;

#[test]
fn completion_intercepts_arguments_for_every_supported_shell() {
    for shell in ["bash", "zsh", "fish", "powershell", "elvish"] {
        let output = Command::new(env!("CARGO_BIN_EXE_spicetify"))
            .env("COMPLETE", shell)
            .arg("--completion-smoke-test")
            .output()
            .expect("spicetify should run");

        assert!(
            output.status.success(),
            "{shell} registration failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(
            String::from_utf8_lossy(&output.stdout).contains("spicetify"),
            "{shell} registration did not name the command"
        );
        assert!(output.stderr.is_empty(), "{shell} registration wrote to stderr");
    }
}
