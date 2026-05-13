use anyhow::Result;

use crate::{config::AppContext, util};

pub fn run(ctx: &AppContext) -> Result<()> {
    // TODO: let the user choose which release to install (& include version compatibility info)
    // Go's sync.go:30 has the same TODO. Currently always downloads the latest hooks release.
    // Should support specifying a version tag and display compatibility with the installed
    // Spotify client version.
    let bytes = reqwest::blocking::get(
        "https://github.com/veryboringhwl/hooks/releases/latest/download/hooks.tar.gz",
    )?
    .bytes()?;

    let hooks = ctx.config_root.join("hooks");
    let _ = std::fs::remove_dir_all(&hooks);
    util::untar_gz_bytes(&bytes, &hooks)?;
    Ok(())
}
