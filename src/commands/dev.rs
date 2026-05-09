use anyhow::{Context, Result};

use crate::{config::AppContext, util};

pub fn run(ctx: &AppContext) -> Result<()> {
    let offline_bnk = ctx.spotify_config_path.join("offline.bnk");

    let mut data = std::fs::read(&offline_bnk).with_context(|| {
        format!(
            "failed to open {} (spotify-config-path: {})",
            offline_bnk.display(),
            ctx.spotify_config_path.display()
        )
    })?;

    patch_developer_mode(&mut data)?;

    std::fs::write(&offline_bnk, &data)?;
    Ok(())
}

fn patch_developer_mode(data: &mut [u8]) -> Result<()> {
    let needle = b"app-developer";
    let mut found = false;

    if let Some(pos) = util::find_bytes(data, needle) {
        let idx = pos + 14;
        if idx < data.len() {
            data[idx] = b'2';
            found = true;
        }
    }

    if let Some(pos) = util::rfind_bytes(data, needle) {
        let idx = pos + 15;
        if idx < data.len() {
            data[idx] = b'2';
            found = true;
        }
    }

    if !found {
        return Err(anyhow::anyhow!(
            "Could not find app-developer key in offline.bnk Try logging in and out of the app"
        ));
    }

    Ok(())
}
