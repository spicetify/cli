use crate::context::AppContext;
use crate::error::Result;
use crate::{fl, util};

pub(crate) fn run(ctx: &AppContext) -> Result<()> {
    let offline_bnk = ctx.offline_bnk_dir.join("offline.bnk");
    let mut data = std::fs::read(&offline_bnk)?;
    patch_developer_mode(&mut data)?;
    std::fs::write(&offline_bnk, &data)?;
    tracing::info!("{}", fl!("app-developer-enabled"));
    Ok(())
}

fn patch_developer_mode(data: &mut [u8]) -> Result<()> {
    let needle = b"app-developer";
    let mut found = false;

    if let Some(pos) = util::find_subslice(data, needle) {
        let idx = pos + 14;
        if let Some(byte) = data.get_mut(idx) {
            *byte = b'2';
            found = true;
        }
    }

    if let Some(pos) = util::rfind_subslice(data, needle) {
        let idx = pos + 15;
        if let Some(byte) = data.get_mut(idx) {
            *byte = b'2';
            found = true;
        }
    }

    if !found {
        return Err(anyhow::anyhow!(fl!("app-developer-not-found")));
    }

    Ok(())
}
