// The client payload the patched index.html loads: our Spicetify wrapper and
// modular loader, embedded into the binary by build.rs.

use std::path::Path;

use crate::error::Result;

/// Apply serves a payload from the config root only when this marker sits
/// beside it; otherwise the embedded copy wins.
pub const LOCAL_MARKER: &str = ".local-payload";

const WRAPPER: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/spicetifyWrapper.js"));
const LOADER: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/modularLoader.js"));

const FILES: [(&str, &[u8]); 2] = [("spicetifyWrapper.js", WRAPPER), ("modularLoader.js", LOADER)];

/// False when the binary was built before `pnpm build:payload` ran.
#[must_use]
pub fn is_embedded() -> bool {
    FILES.iter().all(|(_, bytes)| !bytes.is_empty())
}

/// Writes the embedded payload into `dest`, creating it if needed.
pub fn write_into(dest: &Path) -> Result<()> {
    if !is_embedded() {
        anyhow::bail!(
            "this binary carries no client payload; build it with `pnpm build:payload` and rebuild"
        );
    }
    std::fs::create_dir_all(dest)?;
    for (name, bytes) in FILES {
        std::fs::write(dest.join(name), bytes)?;
    }
    Ok(())
}

/// True when `dir` holds the marker plus every file index.html asks for.
#[must_use]
pub fn is_local_override(dir: &Path) -> bool {
    dir.join(LOCAL_MARKER).is_file() && FILES.iter().all(|(name, _)| dir.join(name).is_file())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_override_needs_both_the_marker_and_the_files() {
        let tmp = std::env::temp_dir().join(format!("spicetify-payload-{}", std::process::id()));
        let dir = tmp.join("hooks");
        std::fs::create_dir_all(&dir).expect("temp dir");

        assert!(!is_local_override(&dir), "an empty dir is not an override");

        for (name, _) in FILES {
            std::fs::write(dir.join(name), b"//").expect("write payload file");
        }
        assert!(!is_local_override(&dir), "files without the marker are not an override");

        std::fs::write(dir.join(LOCAL_MARKER), b"").expect("write marker");
        assert!(is_local_override(&dir), "marker plus files is an override");

        std::fs::remove_file(dir.join("modularLoader.js")).expect("remove one file");
        assert!(!is_local_override(&dir), "an incomplete override must not be used");

        std::fs::remove_dir_all(&tmp).expect("cleanup");
    }
}
