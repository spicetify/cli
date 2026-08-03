use std::path::PathBuf;
#[cfg(target_os = "linux")]
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

    #[error("failed to spawn daemon: {0}")]
    Spawn(#[from] super::process::DaemonSpawnError),
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
impl MacosDaemonManager {
    fn install() -> Result<(), DaemonManagerError> {
        let plist_dir = home_dir()?.join("Library/LaunchAgents");
        std::fs::create_dir_all(&plist_dir)?;
        let exe = current_exe()?;
        let daemon_exe = super::daemon_binary_for(&exe);
        let plist_path = plist_dir.join("app.spicetify.daemon.plist");

        let plist = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>app.spicetify.daemon</string>
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
            xml_escape(&daemon_exe.display().to_string())
        );
        std::fs::write(&plist_path, plist)?;
        run_launchctl(&["load", "-w"], &plist_path);
        Ok(())
    }

    fn uninstall() {
        if let Ok(home) = home_dir() {
            let plist_path = home.join("Library/LaunchAgents/app.spicetify.daemon.plist");
            if plist_path.exists() {
                run_launchctl(&["unload", "-w"], &plist_path);
                if let Err(e) = std::fs::remove_file(&plist_path)
                    && e.kind() != std::io::ErrorKind::NotFound
                {
                    tracing::warn!(error = %e, "failed to remove plist");
                }
            }
        }
    }

    fn is_installed() -> bool {
        home_dir().is_ok_and(|h| h.join("Library/LaunchAgents/app.spicetify.daemon.plist").exists())
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
fn run_launchctl(args: &[&str], plist: &std::path::Path) {
    match std::process::Command::new("launchctl").args(args).arg(plist).status() {
        Ok(s) if !s.success() => tracing::warn!("launchctl exited with {s}"),
        Err(e) => tracing::warn!(error = %e, "failed to run launchctl"),
        _ => {}
    }
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
