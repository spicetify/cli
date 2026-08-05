// Stages the client payload (spicetifyWrapper.js + modularLoader.js, built by
// scripts/build-payload.mjs) into OUT_DIR so src/payload.rs can embed it.
// A missing payload stages an empty placeholder; the binary then refuses to
// apply rather than patching a client with nothing in it.

use std::path::{Path, PathBuf};

const FILES: [&str; 2] = ["spicetifyWrapper.js", "modularLoader.js"];

fn main() {
    let out_dir = PathBuf::from(std::env::var_os("OUT_DIR").expect("cargo sets OUT_DIR"));
    let dist = repo_root().join("dist").join("hooks");

    for name in FILES {
        let src = dist.join(name);
        println!("cargo:rerun-if-changed={}", src.display());

        let bytes = std::fs::read(&src).unwrap_or_default();
        if bytes.is_empty() {
            println!(
                "cargo:warning=payload {name} not found at {}; build it with `pnpm build:payload`",
                src.display()
            );
        }
        std::fs::write(out_dir.join(name), bytes).expect("failed to stage payload into OUT_DIR");
    }
}

/// The cli repo root, four levels above this crate (rust/crates/spicetify).
fn repo_root() -> PathBuf {
    let manifest =
        PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").expect("cargo sets CARGO_MANIFEST_DIR"));
    manifest
        .ancestors()
        .nth(3)
        .map_or_else(|| manifest.clone(), Path::to_path_buf)
}
