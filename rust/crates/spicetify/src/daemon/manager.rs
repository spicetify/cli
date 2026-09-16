use std::path::PathBuf;
#[cfg(any(target_os = "linux", target_os = "macos"))]
use std::time::Duration;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum DaemonManagerError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("daemon auto-start is not supported on this platform")]
    Unsupported,

    #[error("systemctl error: {0}")]
    Systemctl(String),

    #[error("launchctl error: {0}")]
    Launchctl(String),

    #[error("daemon shutdown is incomplete: {0}")]
    ShutdownIncomplete(String),

    #[error("failed to spawn daemon: {0}")]
    Spawn(#[from] super::process::DaemonSpawnError),
}

impl DaemonManagerError {
    pub(crate) fn allows_unmanaged_fallback(&self) -> bool {
        !matches!(self, Self::Launchctl(_) | Self::ShutdownIncomplete(_))
    }
}

#[derive(Debug, Clone, Copy)]
pub enum DaemonManager {
    #[cfg(windows)]
    Windows,
    #[cfg(target_os = "macos")]
    Macos,
    #[cfg(target_os = "linux")]
    Linux,
    #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
    Unsupported,
}

impl DaemonManager {
    pub fn create() -> Self {
        #[cfg(windows)]
        {
            Self::Windows
        }
        #[cfg(target_os = "macos")]
        {
            Self::Macos
        }
        #[cfg(target_os = "linux")]
        {
            Self::Linux
        }
        #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
        {
            Self::Unsupported
        }
    }

    pub fn install(self) -> Result<(), DaemonManagerError> {
        match self {
            #[cfg(windows)]
            Self::Windows => WindowsDaemonManager::install(),
            #[cfg(target_os = "macos")]
            Self::Macos => MacosDaemonManager::install(),
            #[cfg(target_os = "linux")]
            Self::Linux => LinuxDaemonManager::install(),
            #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
            Self::Unsupported => UnsupportedDaemonManager::install(),
        }
    }

    pub fn uninstall(self) {
        match self {
            #[cfg(windows)]
            Self::Windows => WindowsDaemonManager::uninstall(),
            #[cfg(target_os = "macos")]
            Self::Macos => MacosDaemonManager::uninstall(),
            #[cfg(target_os = "linux")]
            Self::Linux => LinuxDaemonManager::uninstall(),
            #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
            Self::Unsupported => UnsupportedDaemonManager::uninstall(),
        }
    }

    pub fn is_installed(self) -> bool {
        match self {
            #[cfg(windows)]
            Self::Windows => WindowsDaemonManager::is_installed(),
            #[cfg(target_os = "macos")]
            Self::Macos => MacosDaemonManager::is_installed(),
            #[cfg(target_os = "linux")]
            Self::Linux => LinuxDaemonManager::is_installed(),
            #[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
            Self::Unsupported => UnsupportedDaemonManager::is_installed(),
        }
    }
}

#[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
#[derive(Debug, Clone, Copy)]
pub struct UnsupportedDaemonManager;
#[cfg(not(any(windows, target_os = "macos", target_os = "linux")))]
impl UnsupportedDaemonManager {
    fn install() -> Result<(), DaemonManagerError> {
        Err(DaemonManagerError::Unsupported)
    }

    fn uninstall() {}

    fn is_installed() -> bool {
        false
    }
}

#[cfg(windows)]
#[derive(Debug, Clone, Copy)]
pub struct WindowsDaemonManager;
#[cfg(windows)]
impl WindowsDaemonManager {
    fn install() -> Result<(), DaemonManagerError> {
        use windows_registry::CURRENT_USER;

        let exe = current_exe()?;
        let daemon_exe = super::daemon_binary_for(&exe);
        let run_key = r"Software\Microsoft\Windows\CurrentVersion\Run";

        tracing::info!("registering daemon auto-start in HKCU\\Run");
        let key = CURRENT_USER.create(run_key).map_err(registry_err)?;
        key.set_string("Spicetify Daemon", format!("\"{}\"", daemon_exe.display()))
            .map_err(registry_err)?;

        tracing::info!("registering spicetify:// URL scheme");
        crate::platform::register_url_scheme();

        tracing::info!("spawning daemon process");
        super::process::spawn()?;
        Ok(())
    }

    fn uninstall() {
        use windows_registry::CURRENT_USER;

        tracing::info!("removing daemon auto-start from HKCU\\Run");
        let run_key = r"Software\Microsoft\Windows\CurrentVersion\Run";
        // needs write perms to delete value
        if let Ok(key) = CURRENT_USER.options().write().open(run_key)
            && let Err(e) = key.remove_value("Spicetify Daemon")
        {
            tracing::warn!(error = %e, "failed to delete Run registry value");
        }

        tracing::info!("removing spicetify:// URL scheme registration");
        if let Err(e) = CURRENT_USER.remove_tree(r"Software\Classes\spicetify") {
            tracing::warn!(error = %e, "failed to delete spicetify:// URL scheme registration");
        }
    }

    fn is_installed() -> bool {
        use windows_registry::CURRENT_USER;

        CURRENT_USER
            .open(r"Software\Microsoft\Windows\CurrentVersion\Run")
            .and_then(|key| key.get_string("Spicetify Daemon"))
            .is_ok()
    }
}

#[cfg(windows)]
fn registry_err(e: impl std::fmt::Display) -> DaemonManagerError {
    DaemonManagerError::Io(std::io::Error::other(e.to_string()))
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, Copy)]
pub struct MacosDaemonManager;
#[cfg(target_os = "macos")]
const LAUNCH_AGENT_LABEL: &str = "app.spicetify.daemon";

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LaunchAgentInstallAction {
    Noop,
    Load,
    Reload,
}

#[cfg(target_os = "macos")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LaunchAgentState {
    Unloaded,
    LoadedStopped,
    Running,
}

#[cfg(target_os = "macos")]
fn launch_agent_install_action(
    existing_plist: Option<&str>,
    desired_plist: &str,
    state: LaunchAgentState,
) -> LaunchAgentInstallAction {
    if state == LaunchAgentState::Running && existing_plist == Some(desired_plist) {
        LaunchAgentInstallAction::Noop
    } else if state == LaunchAgentState::Unloaded {
        LaunchAgentInstallAction::Load
    } else {
        LaunchAgentInstallAction::Reload
    }
}

#[cfg(target_os = "macos")]
fn launch_agent_path(home: &std::path::Path) -> PathBuf {
    home.join("Library/LaunchAgents").join(format!("{LAUNCH_AGENT_LABEL}.plist"))
}

#[cfg(target_os = "macos")]
impl MacosDaemonManager {
    fn install() -> Result<(), DaemonManagerError> {
        let home = home_dir()?;
        let plist_dir = home.join("Library/LaunchAgents");
        std::fs::create_dir_all(&plist_dir)?;
        let exe = current_exe()?;
        let daemon_exe = super::daemon_binary_for(&exe);
        let plist_path = launch_agent_path(&home);

        let plist = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>"#,
            LAUNCH_AGENT_LABEL,
            xml_escape(&daemon_exe.display().to_string())
        );
        let existing_plist = std::fs::read_to_string(&plist_path).ok();
        let plist_changed = existing_plist.as_deref() != Some(&plist);
        let status = launch_agent_status()?;
        let action = launch_agent_install_action(existing_plist.as_deref(), &plist, status);

        match action {
            LaunchAgentInstallAction::Noop => Ok(()),
            LaunchAgentInstallAction::Load => {
                stop_unmanaged_daemon()?;
                if plist_changed {
                    std::fs::write(&plist_path, &plist)?;
                }
                run_launchctl(&["load", "-w"], Some(&plist_path)).map(|_| ())
            }
            LaunchAgentInstallAction::Reload => {
                let _ = run_launchctl(&["remove", LAUNCH_AGENT_LABEL], None)?;
                stop_unmanaged_daemon()?;
                if plist_changed {
                    std::fs::write(&plist_path, &plist)?;
                }
                run_launchctl(&["load", "-w"], Some(&plist_path)).map(|_| ())
            }
        }
    }

    fn uninstall() {
        if let Ok(home) = home_dir() {
            let plist_path = launch_agent_path(&home);
            if plist_path.exists() {
                if let Err(e) = run_launchctl(&["unload", "-w"], Some(&plist_path)) {
                    tracing::warn!(error = %e, "failed to unload daemon auto-start");
                }
                if let Err(e) = std::fs::remove_file(&plist_path)
                    && e.kind() != std::io::ErrorKind::NotFound
                {
                    tracing::warn!(error = %e, "failed to remove plist");
                }
            }
        }
    }

    fn is_installed() -> bool {
        home_dir().is_ok_and(|home| launch_agent_path(&home).exists())
    }
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone, Copy)]
pub struct LinuxDaemonManager;
#[cfg(target_os = "linux")]
impl LinuxDaemonManager {
    fn install() -> Result<(), DaemonManagerError> {
        if !is_systemd_available() {
            return Err(DaemonManagerError::Unsupported);
        }

        let systemd_dir = home_dir()?.join(".config/systemd/user");
        std::fs::create_dir_all(&systemd_dir)?;

        let exe = current_exe()?;
        let daemon_exe = super::daemon_binary_for(&exe);
        let service = format!(
            "\
[Unit]
Description=Spicetify Daemon
Documentation=https://spicetify.app

[Service]
Type=simple
ExecStart={}
Restart=on-failure
RestartSec=5
TimeoutStopSec=10

[Install]
WantedBy=default.target
",
            systemd_quote(&daemon_exe.display().to_string()),
        );

        let service_path = systemd_dir.join("spicetify-daemon.service");
        std::fs::write(&service_path, service)?;

        if let Err(e) = run_systemctl(&["--user", "daemon-reload"]) {
            tracing::warn!(error = %e, "systemctl daemon-reload failed");
        }
        run_systemctl(&["--user", "enable", "--now", "spicetify-daemon"])?;

        Ok(())
    }

    fn uninstall() {
        if let Err(e) = run_systemctl(&["--user", "disable", "--now", "spicetify-daemon"]) {
            tracing::warn!(error = %e, "systemctl disable failed");
        }
        if let Err(e) = run_systemctl(&["--user", "daemon-reload"]) {
            tracing::warn!(error = %e, "systemctl daemon-reload failed");
        }

        if let Ok(home) = home_dir() {
            let path = home.join(".config/systemd/user/spicetify-daemon.service");
            if let Err(e) = std::fs::remove_file(&path)
                && e.kind() != std::io::ErrorKind::NotFound
            {
                tracing::warn!(error = %e, path = %path.display(), "failed to remove service file");
            }
        }
    }

    fn is_installed() -> bool {
        home_dir().is_ok_and(|h| h.join(".config/systemd/user/spicetify-daemon.service").exists())
    }
}

fn current_exe() -> Result<PathBuf, DaemonManagerError> {
    std::env::current_exe().map_err(DaemonManagerError::Io)
}

#[cfg(target_os = "macos")]
fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn home_dir() -> Result<PathBuf, DaemonManagerError> {
    directories::BaseDirs::new().map(|b| b.home_dir().to_path_buf()).ok_or_else(|| {
        DaemonManagerError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "home directory not found",
        ))
    })
}

#[cfg(target_os = "macos")]
fn launch_agent_status() -> Result<LaunchAgentState, DaemonManagerError> {
    let output = run_launchctl(&["list"], None)?;
    Ok(parse_launch_agent_status(&String::from_utf8_lossy(&output)))
}

#[cfg(target_os = "macos")]
fn parse_launch_agent_status(list: &str) -> LaunchAgentState {
    for line in list.lines() {
        let mut fields = line.split_whitespace();
        let pid = fields.next();
        let _ = fields.next();
        if fields.next() == Some(LAUNCH_AGENT_LABEL) {
            return if pid.is_some_and(|pid| pid.parse::<u32>().is_ok_and(|pid| pid > 0)) {
                LaunchAgentState::Running
            } else {
                LaunchAgentState::LoadedStopped
            };
        }
    }
    LaunchAgentState::Unloaded
}

#[cfg(target_os = "macos")]
fn stop_unmanaged_daemon() -> Result<(), DaemonManagerError> {
    stop_unmanaged_daemon_and_wait()
        .map_err(|error| DaemonManagerError::ShutdownIncomplete(error.to_string()))
}

#[cfg(target_os = "macos")]
fn stop_unmanaged_daemon_and_wait() -> Result<(), DaemonManagerError> {
    let path = crate::platform::default_spicetify_config_dir().join("spicetify-daemon.lock");
    // Keep the original inode open: the daemon unlinks this path before dropping its lock.
    let lock_file = match std::fs::File::open(path) {
        Ok(file) => Some(file),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(error.into()),
    };
    if super::is_daemon_running() || daemon_process_running()? {
        super::shutdown_daemon();
    }
    wait_for_daemon_exit(lock_file.as_ref(), Duration::from_secs(5), daemon_process_running)
}

#[cfg(target_os = "macos")]
fn daemon_process_running() -> Result<bool, DaemonManagerError> {
    let status = std::process::Command::new("pgrep")
        .args(["-x", super::daemon_binary_name()])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()?;
    match status.code() {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        _ => {
            Err(std::io::Error::other(format!("failed to inspect daemon process: {status}")).into())
        }
    }
}

#[cfg(target_os = "macos")]
fn wait_for_daemon_exit(
    lock_file: Option<&std::fs::File>,
    timeout: Duration,
    mut process_running: impl FnMut() -> Result<bool, DaemonManagerError>,
) -> Result<(), DaemonManagerError> {
    let deadline = std::time::Instant::now() + timeout;
    loop {
        let lock_released = if let Some(file) = lock_file {
            match fs4::FileExt::try_lock(file) {
                Ok(()) => {
                    fs4::FileExt::unlock(file)?;
                    true
                }
                Err(fs4::TryLockError::WouldBlock) => false,
                Err(fs4::TryLockError::Error(error)) => return Err(error.into()),
            }
        } else {
            true
        };
        if !process_running()? && lock_released {
            return Ok(());
        }
        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        if remaining.is_zero() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::TimedOut,
                "daemon did not exit before launch-agent startup; auto-start was not loaded",
            )
            .into());
        }
        std::thread::sleep(remaining.min(Duration::from_millis(50)));
    }
}

#[cfg(target_os = "macos")]
fn run_launchctl(
    args: &[&str],
    plist: Option<&std::path::Path>,
) -> Result<Vec<u8>, DaemonManagerError> {
    let mut command = std::process::Command::new("launchctl");
    let _ = command.args(args);
    if let Some(plist) = plist {
        let _ = command.arg(plist);
    }

    let output = command
        .output()
        .map_err(|error| DaemonManagerError::Launchctl(format!("{}: {error}", args.join(" "))))?;
    launchctl_output(args, output)
}

#[cfg(target_os = "macos")]
fn launchctl_output(
    args: &[&str],
    output: std::process::Output,
) -> Result<Vec<u8>, DaemonManagerError> {
    if output.status.success() {
        return Ok(output.stdout);
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
    let detail = if stderr.is_empty() {
        format!("{} exited with {}", args.join(" "), output.status)
    } else {
        format!("{}: {stderr}", args.join(" "))
    };
    Err(DaemonManagerError::Launchctl(detail))
}

#[cfg(target_os = "linux")]
fn is_systemd_available() -> bool {
    std::process::Command::new("systemctl")
        .args(["--user", "show-environment"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok_and(|s| s.success())
}

#[cfg(target_os = "linux")]
fn systemd_quote(s: &str) -> String {
    let escaped = s.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}

#[cfg(target_os = "linux")]
fn run_systemctl(args: &[&str]) -> Result<(), DaemonManagerError> {
    let mut child = std::process::Command::new("systemctl")
        .args(args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| DaemonManagerError::Systemctl(format!("failed to spawn systemctl: {e}")))?;

    let deadline = std::time::Instant::now() + Duration::from_secs(15);
    loop {
        match child.try_wait()? {
            Some(status) if status.success() => return Ok(()),
            Some(status) => {
                return Err(DaemonManagerError::Systemctl(format!(
                    "systemctl {} exited with {status}",
                    args.join(" "),
                )));
            }
            None => {
                if std::time::Instant::now() >= deadline {
                    child.kill()?;
                    child.wait().map(|_| ())?;
                    return Err(DaemonManagerError::Systemctl(format!(
                        "systemctl {} timed out after 15s",
                        args.join(" "),
                    )));
                }
                std::thread::sleep(Duration::from_millis(50));
            }
        }
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::{
        DaemonManagerError, LaunchAgentInstallAction, LaunchAgentState,
        launch_agent_install_action, launchctl_output, parse_launch_agent_status,
        wait_for_daemon_exit,
    };
    use std::os::unix::process::ExitStatusExt;

    #[test]
    fn an_unlinked_instance_lock_still_blocks_loading_after_the_listener_closes()
    -> anyhow::Result<()> {
        let path = std::env::temp_dir().join(format!("spicetify-exit-lock-{}", std::process::id()));
        let owner = std::fs::File::create(&path)?;
        fs4::FileExt::try_lock(&owner)?;
        let observer = std::fs::File::open(&path)?;
        std::fs::remove_file(&path)?;
        let result = wait_for_daemon_exit(Some(&observer), std::time::Duration::ZERO, || Ok(false));
        assert!(
            matches!(result, Err(DaemonManagerError::Io(error)) if error.kind() == std::io::ErrorKind::TimedOut)
        );
        drop(owner);
        wait_for_daemon_exit(Some(&observer), std::time::Duration::ZERO, || Ok(false))?;
        fs4::FileExt::try_lock(&observer)?;
        fs4::FileExt::unlock(&observer)?;
        Ok(())
    }

    #[test]
    fn a_process_that_has_not_exited_blocks_loading_without_a_lock_file() {
        let result = wait_for_daemon_exit(None, std::time::Duration::ZERO, || Ok(true));
        assert!(
            matches!(result, Err(DaemonManagerError::Io(error)) if error.kind() == std::io::ErrorKind::TimedOut)
        );
    }

    #[test]
    fn daemon_exit_waits_until_the_process_is_gone() -> anyhow::Result<()> {
        let mut probes = 0;
        wait_for_daemon_exit(None, std::time::Duration::from_secs(1), || {
            probes += 1;
            Ok(probes < 2)
        })?;
        assert_eq!(probes, 2);
        Ok(())
    }

    #[test]
    fn process_inspection_failure_does_not_allow_loading() {
        let result = wait_for_daemon_exit(None, std::time::Duration::ZERO, || {
            Err(std::io::Error::from(std::io::ErrorKind::PermissionDenied).into())
        });
        assert!(
            matches!(result, Err(DaemonManagerError::Io(error)) if error.kind() == std::io::ErrorKind::PermissionDenied)
        );
    }

    #[test]
    fn launch_agent_list_distinguishes_running_stopped_and_missing_jobs() {
        assert_eq!(
            parse_launch_agent_status("PID\tStatus\tLabel\n123\t0\tapp.spicetify.daemon\n"),
            LaunchAgentState::Running
        );
        assert_eq!(
            parse_launch_agent_status("PID\tStatus\tLabel\n-\t1\tapp.spicetify.daemon\n"),
            LaunchAgentState::LoadedStopped
        );
        assert_eq!(
            parse_launch_agent_status("PID\tStatus\tLabel\n123\t0\tapp.spicetify.daemon.other\n"),
            LaunchAgentState::Unloaded
        );
    }

    #[test]
    fn launchctl_failures_report_command_and_stderr() {
        let error = launchctl_output(
            &["load", "-w"],
            std::process::Output {
                status: std::process::ExitStatus::from_raw(5 << 8),
                stdout: Vec::new(),
                stderr: b"Input/output error\n".to_vec(),
            },
        )
        .expect_err("failed launchctl must not report success");
        assert!(matches!(error, DaemonManagerError::Launchctl(_)));
        assert!(error.to_string().contains("load -w: Input/output error"));
    }

    #[test]
    fn launchctl_list_failure_is_not_an_unloaded_job() {
        let error = launchctl_output(
            &["list"],
            std::process::Output {
                status: std::process::ExitStatus::from_raw(1 << 8),
                stdout: Vec::new(),
                stderr: Vec::new(),
            },
        )
        .expect_err("an unavailable launchd must not trigger daemon replacement");
        assert!(error.to_string().contains("list exited with"));
    }

    #[test]
    fn successful_launchctl_returns_the_job_list() {
        let list = b"PID\tStatus\tLabel\n123\t0\tapp.spicetify.daemon\n";
        let output = launchctl_output(
            &["list"],
            std::process::Output {
                status: std::process::ExitStatus::from_raw(0),
                stdout: list.to_vec(),
                stderr: Vec::new(),
            },
        )
        .expect("launchctl succeeded");
        assert_eq!(output, list);
    }

    #[test]
    fn missing_plist_reloads_an_existing_registration() {
        assert_eq!(
            launch_agent_install_action(None, "desired plist", LaunchAgentState::Running),
            LaunchAgentInstallAction::Reload
        );
    }

    #[test]
    fn first_install_loads_the_launch_agent() {
        assert_eq!(
            launch_agent_install_action(None, "desired plist", LaunchAgentState::Unloaded),
            LaunchAgentInstallAction::Load
        );
    }

    #[test]
    fn unchanged_loaded_launch_agent_is_not_loaded_twice() {
        assert_eq!(
            launch_agent_install_action(
                Some("desired plist"),
                "desired plist",
                LaunchAgentState::Running,
            ),
            LaunchAgentInstallAction::Noop
        );
    }

    #[test]
    fn unchanged_loaded_launch_agent_replaces_an_unmanaged_daemon() {
        assert_eq!(
            launch_agent_install_action(
                Some("desired plist"),
                "desired plist",
                LaunchAgentState::LoadedStopped,
            ),
            LaunchAgentInstallAction::Reload
        );
    }

    #[test]
    fn unloaded_launch_agent_is_loaded_even_when_plist_is_unchanged() {
        assert_eq!(
            launch_agent_install_action(
                Some("desired plist"),
                "desired plist",
                LaunchAgentState::Unloaded,
            ),
            LaunchAgentInstallAction::Load
        );
    }

    #[test]
    fn changed_loaded_launch_agent_is_reloaded() {
        assert_eq!(
            launch_agent_install_action(
                Some("old plist"),
                "desired plist",
                LaunchAgentState::Running,
            ),
            LaunchAgentInstallAction::Reload
        );
    }
}
