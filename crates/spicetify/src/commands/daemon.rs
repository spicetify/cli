use anyhow::Result;

use crate::{
    config::{AppContext, Config}, daemon, i18n, logging
};

pub fn start(ctx: &AppContext) -> Result<()> {
    daemon::server::start(ctx)
}

pub fn enable(ctx: &AppContext) -> Result<()> {
    let mut cfg = Config::load(&ctx.config_file)?;
    cfg.daemon = true;
    Config::save(&ctx.config_file, &cfg)
}

pub fn disable(ctx: &AppContext) -> Result<()> {
    let mut cfg = Config::load(&ctx.config_file)?;
    cfg.daemon = false;
    Config::save(&ctx.config_file, &cfg)
}

pub fn auto(ctx: &AppContext) -> Result<()> {
    if ctx.daemon {
        logging::info(i18n::lookup("daemon_starting"));
        start(ctx)
    } else {
        Ok(())
    }
}
