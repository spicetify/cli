use anyhow::{Context, Result};

use crate::{config::AppContext, i18n, util};

pub fn run(ctx: &AppContext) -> Result<()> {
    let offline_bnk = ctx.spotify_config_path.join("offline.bnk");

    let mut data = std::fs::read(&offline_bnk).with_context(|| {
        i18n::lookup_with_args(
            "failed_open_offline_bnk",
            &[
                ("path", &offline_bnk.display().to_string()),
                (
                    "config_path",
                    &ctx.spotify_config_path.display().to_string(),
                ),
            ],
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
        return Err(anyhow::anyhow!(i18n::lookup("app_developer_not_found")));
    }

    Ok(())
}
