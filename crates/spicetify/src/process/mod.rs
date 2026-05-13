use std::{
    ffi::OsStr, process::Command, thread, time::{Duration, Instant}
};

use anyhow::{Context, Result};

use crate::{config::AppContext, i18n, logging};

const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(15);
const START_TIMEOUT: Duration = Duration::from_secs(30);
const MIN_POLL: Duration = Duration::from_millis(100);
const MAX_POLL: Duration = Duration::from_millis(800);

pub fn start(ctx: &AppContext) -> Result<()> {
    launch(ctx)?;
    wait_for_start(ctx, START_TIMEOUT).with_context(|| i18n::lookup("spotify_launch_failed"))?;
    logging::info(i18n::lookup("spotify_started"));
    Ok(())
}

pub fn stop(ctx: &AppContext) -> Result<()> {
    logging::info(i18n::lookup("spotify_stopping"));
    kill(ctx)?;
    wait_for_exit(ctx, SHUTDOWN_TIMEOUT);
    Ok(())
}

pub fn restart(ctx: &AppContext) -> Result<()> {
    stop(ctx)?;
    start(ctx)?;
    logging::info(i18n::lookup("spotify_restarted"));
    Ok(())
}

pub fn restart_if_running(ctx: &AppContext) -> Result<()> {
    if is_running(ctx) {
        restart(ctx)
    } else {
        Ok(())
    }
}

fn launch(ctx: &AppContext) -> Result<()> {
    let mut args = Vec::new();
    if ctx.mirror {
        args.push(format!(
            "--app-directory={}",
            ctx.config_root.join("apps").display()
        ));
    }
    Command::new(&ctx.spotify_exec_path)
        .args(&args)
        .spawn()
        .with_context(|| i18n::lookup("spotify_launch_failed"))?;
    Ok(())
}

fn wait_for_exit(ctx: &AppContext, timeout: Duration) {
    let start = Instant::now();
    let mut interval = MIN_POLL;
    while is_running(ctx) {
        if start.elapsed() >= timeout {
            logging::warn(i18n::lookup("spotify_exit_timeout"));
            return;
        }
        thread::sleep(interval);
        interval = (interval * 2).min(MAX_POLL);
    }
}

fn wait_for_start(ctx: &AppContext, timeout: Duration) -> Result<()> {
    let start = Instant::now();
    let mut interval = MIN_POLL;
    loop {
        if is_running(ctx) {
            return Ok(());
        }
        if start.elapsed() >= timeout {
            anyhow::bail!(i18n::lookup_with_args(
                "spotify_start_timeout",
                &[("secs", &timeout.as_secs().to_string())]
            ));
        }
        thread::sleep(interval);
        interval = (interval * 2).min(MAX_POLL);
    }
}

fn image_name(ctx: &AppContext) -> String {
    ctx.spotify_exec_path
        .file_name()
        .and_then(OsStr::to_str)
        .map(String::from)
        .unwrap_or_else(|| {
            if cfg!(unix) {
                "spotify".into()
            } else {
                "spotify.exe".into()
            }
        })
}

#[cfg(windows)]
fn is_running(ctx: &AppContext) -> bool {
    let image = image_name(ctx);
    match Command::new("tasklist")
        .args(["/FI", &format!("IMAGENAME eq {image}"), "/FO", "CSV", "/NH"])
        .output()
    {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout)
            .to_ascii_lowercase()
            .contains(&format!("\"{}\"", image.to_ascii_lowercase())),
        _ => false,
    }
}

#[cfg(windows)]
fn kill(ctx: &AppContext) -> Result<()> {
    let image = image_name(ctx);
    let output = Command::new("taskkill")
        .args(["/IM", &image, "/T", "/F"])
        .output()
        .with_context(|| i18n::lookup_with_args("taskkill_failed", &[("exe", &image), ("err", "...")]))?;

    if output.status.success() {
        return Ok(());
    }
    let stderr = String::from_utf8_lossy(&output.stderr).to_ascii_lowercase();
    if stderr.contains("not found") || stderr.contains("no running instance") {
        return Ok(());
    }
    anyhow::bail!(i18n::lookup_with_args(
        "taskkill_failed",
        &[
            ("exe", &image),
            (
                "err",
                &String::from_utf8_lossy(&output.stderr).trim().to_string()
            )
        ]
    ))
}

#[cfg(unix)]
fn is_running(ctx: &AppContext) -> bool {
    for name in process_names(ctx) {
        if Command::new("pgrep")
            .args(["-x", &name])
            .status()
            .is_ok_and(|s| s.success())
        {
            return true;
        }
    }
    false
}

#[cfg(unix)]
fn kill(ctx: &AppContext) -> Result<()> {
    for name in process_names(ctx) {
        let _ = Command::new("pkill").args(["-x", &name]).status();
    }
    Ok(())
}

#[cfg(unix)]
fn process_names(ctx: &AppContext) -> Vec<String> {
    let mut names = Vec::new();
    if let Some(name) = ctx.spotify_exec_path.file_name().and_then(OsStr::to_str) {
        if !name.is_empty() {
            names.push(name.to_string());
            if let Some(stem) = ctx.spotify_exec_path.file_stem().and_then(OsStr::to_str) {
                if !stem.is_empty() {
                    names.push(stem.to_string());
                }
            }
        }
    }
    names.push("Spotify".into());
    names.push("spotify".into());
    names.sort();
    names.dedup();
    names
}
