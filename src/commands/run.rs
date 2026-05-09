use std::process::Command;

use anyhow::{Context, Result};

use crate::config::AppContext;

pub fn run(ctx: &AppContext, extra_args: &[String]) -> Result<()> {
    let mut args = Vec::new();
    if ctx.mirror {
        args.push(format!(
            "--app-directory={}",
            ctx.config_root.join("apps").display()
        ));
    }
    args.extend_from_slice(extra_args);

    Command::new(&ctx.spotify_exec_path)
        .args(&args)
        .spawn()
        .with_context(|| format!("failed to start {}", ctx.spotify_exec_path.display()))?;
    Ok(())
}
