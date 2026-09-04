// Stages the client payload (spicetifyWrapper.js + modularLoader.js, built by
// scripts/build-payload.mjs) into OUT_DIR so src/payload.rs can embed it.
// A missing payload stages an empty placeholder; the binary then refuses to
// apply rather than patching a client with nothing in it.

use std::path::{Path, PathBuf};

const FILES: [&str; 2] = ["spicetifyWrapper.js", "modularLoader.js"];

fn main() {
    let out_dir = PathBuf::from(std::env::var_os("OUT_DIR").expect("cargo sets OUT_DIR"));
    let root = repo_root();
    let dist = root.join("dist").join("hooks");

    // The repo's css-map.json is the CLI's own data (per-version overlays are
    // fetched beside the classmap), so it rides in the binary.
    let css_map = root.join("css-map.json");
    println!("cargo:rerun-if-changed={}", css_map.display());
    let css_bytes = std::fs::read(&css_map).unwrap_or_default();
    if css_bytes.is_empty() {
        println!("cargo:warning=css-map.json not found at {}", css_map.display());
    }
    std::fs::write(out_dir.join("css-map.json"), css_bytes)
        .expect("failed to stage the css map into OUT_DIR");

    // The exposure patch set is published by spicetify/classmaps and fetched
    // at apply time; this copy is the offline baseline.
    // A binary without one would expose nothing, so its absence fails the
    // build rather than shipping an inert CLI.
    let expose = root.join("expose.json");
    println!("cargo:rerun-if-changed={}", expose.display());
    std::fs::copy(&expose, out_dir.join("expose.json"))
        .map(drop)
        .expect("expose.json is required beside css-map.json at the cli repo root");

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
    let manifest = PathBuf::from(
        std::env::var_os("CARGO_MANIFEST_DIR").expect("cargo sets CARGO_MANIFEST_DIR"),
    );
    manifest.ancestors().nth(3).map_or_else(|| manifest.clone(), Path::to_path_buf)
}
