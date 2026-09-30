use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Component, Path, PathBuf};
use std::process::Command;

use anyhow::{Context, ensure};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::context::{AppContext, Config};
use crate::error::Result;

const ORIGIN: &str = "https://repository.spotify.com";
const RECORD: &str = ".spicetify-install.json";
const MAX_PACKAGE_SIZE: u64 = 512 * 1024 * 1024;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Channel {
    Stable,
    Testing,
}

impl Channel {
    pub(crate) fn name(self) -> &'static str {
        match self {
            Self::Stable => "stable",
            Self::Testing => "testing",
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum Action {
    Install(Option<Channel>),
    Update(Option<Channel>),
    Status,
}

#[derive(Debug, Serialize, Deserialize)]
struct Installation {
    version: String,
    channel: Channel,
    sha256: String,
}

#[derive(Debug)]
struct Package {
    version: String,
    filename: String,
    sha256: String,
    size: u64,
}

fn base_dirs() -> Result<directories::BaseDirs> {
    directories::BaseDirs::new().context("cannot determine the user data directory")
}

fn install_root() -> Result<PathBuf> {
    Ok(base_dirs()?.data_dir().join("spicetify/spotify"))
}

fn installed(ctx: &AppContext) -> Result<Option<Installation>> {
    let root = install_root()?.join("versions");
    if !root.exists() || !ctx.spotify_data_dir.exists() {
        return Ok(None);
    }
    let data = ctx.spotify_data_dir.canonicalize()?;
    if !data.starts_with(root.canonicalize()?)
        || ctx.spotify_exec.canonicalize().ok() != Some(data.join("spotify"))
    {
        return Ok(None);
    }
    let record = fs::read(data.join(RECORD)).context("managed installation record is missing")?;
    Ok(Some(serde_json::from_slice(&record)?))
}

pub(crate) fn managed_channel(ctx: &AppContext) -> Result<Option<Channel>> {
    Ok(installed(ctx)?.map(|record| record.channel))
}

pub fn run(ctx: &AppContext, action: &Action) -> Result<()> {
    ensure!(std::env::consts::ARCH == "x86_64", "Spotify's Linux package requires x86_64");
    if matches!(action, Action::Status) {
        return status(ctx);
    }
    let guard = super::guard::try_acquire(&ctx.config_root)?;
    run_inner(ctx, *action, &guard, true, &mut |_| Ok(()))
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Phase {
    Checking,
    Downloading,
    Preparing,
    Activating,
}

/// The daemon keeps running while it owns the update and follows the new config.
pub fn update_managed(
    ctx: &AppContext,
    guard: &super::guard::DisruptiveOperationGuard,
    mut progress: impl FnMut(Phase) -> Result<()>,
) -> Result<()> {
    run_inner(ctx, Action::Update(None), guard, false, &mut progress)
}

fn run_inner(
    ctx: &AppContext,
    action: Action,
    guard: &super::guard::DisruptiveOperationGuard,
    manage_daemon: bool,
    progress: &mut impl FnMut(Phase) -> Result<()>,
) -> Result<()> {
    progress(Phase::Checking)?;
    let current = installed(ctx)?;
    let channel = match action {
        Action::Install(channel) => channel
            .unwrap_or_else(|| current.as_ref().map_or(Channel::Stable, |record| record.channel)),
        Action::Update(channel) => {
            let current = current.as_ref().context(
                "Spotify is not managed by Spicetify; run `spicetify spotify install` first",
            )?;
            channel.unwrap_or(current.channel)
        }
        Action::Status => unreachable!(),
    };
    let package = latest(channel)?;
    let actual_version =
        ctx.spotify_exec.is_file().then(|| executable_version(&ctx.spotify_exec)).transpose()?;
    if let Some(version) = &actual_version {
        ensure_no_downgrade(version, &package.version)?;
    }
    if matches!(action, Action::Update(_))
        && let Some(current) = &current
        && current.version == package.version
        && current.sha256 == package.sha256
        && actual_version.as_deref() == Some(package.version.as_str())
    {
        repair_launchers(ctx)?;
        tracing::info!("Spotify {} is already installed", current.version);
        // A channel change can point at exactly the same package.
        let record = Installation {
            channel,
            version: current.version.clone(),
            sha256: current.sha256.clone(),
        };
        atomic_write(&ctx.spotify_data_dir.join(RECORD), &serde_json::to_vec_pretty(&record)?)?;
        return Ok(());
    }
    verify_support(ctx, &package.version)?;
    progress(Phase::Downloading)?;
    let archive = download(&package)?;
    let versions = install_root()?.join("versions");
    fs::create_dir_all(&versions)?;
    let candidate = versions.join(format!("{}-{}", package.version, nonce()?));
    fs::create_dir(&candidate)?;
    let result = (|| {
        progress(Phase::Preparing)?;
        tracing::info!("Preparing Spotify {} from the {} channel", package.version, channel.name());
        extract_deb(&archive, &candidate)?;
        check_dependencies(&candidate)?;
        ensure!(
            executable_version(&candidate.join("spotify"))? == package.version,
            "downloaded executable version does not match Spotify's package metadata"
        );

        let mut config = Config::load(&ctx.config_file)?;
        config.spotify_exec = Some(candidate.join("spotify"));
        config.spotify_data_dir = Some(candidate.clone());
        config.mirror = false;
        let next = AppContext::from_config(ctx.config_root.clone(), &config)?;
        let record = Installation {
            version: package.version.clone(),
            channel,
            sha256: package.sha256.clone(),
        };
        fs::write(candidate.join(RECORD), serde_json::to_vec_pretty(&record)?)?;
        super::apply::prepare(&next, guard)?;
        let manifest: serde_json::Value =
            serde_json::from_slice(&fs::read(candidate.join("Apps/xpui/modules/manifest.json"))?)?;
        ensure!(
            manifest.get("classmapVerified").and_then(serde_json::Value::as_bool) == Some(true)
                && manifest.get("classmapSpotify").and_then(serde_json::Value::as_str)
                    == Some(version_line(&package.version)?.as_str()),
            "prepared client did not use a verified classmap for this Spotify version"
        );
        progress(Phase::Activating)?;
        activate(ctx, &next, &config, &candidate, manage_daemon)?;
        tracing::info!("Spotify {} installed at {}", package.version, candidate.display());
        tracing::info!(
            "Use `spicetify spotify update` for future package updates. Native updater blocking remains a separate check."
        );
        Ok(())
    })();
    // Keep failed candidates: activation recovery may need them, and no existing install is deleted.
    if result.is_err() {
        tracing::warn!(path = %candidate.display(), "installation did not finish; retained candidate for recovery");
    }
    result
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case", rename_all_fields = "camelCase")]
pub enum InstallationStatus {
    External,
    Unavailable { message: String },
    Managed { version: String, channel: Channel, native_blocked: Option<bool> },
}

pub fn installation_status(ctx: &AppContext) -> Result<InstallationStatus> {
    Ok(match installed(ctx)? {
        None => InstallationStatus::External,
        Some(record) => InstallationStatus::Managed {
            version: executable_version(&ctx.spotify_exec)?,
            channel: record.channel,
            native_blocked: super::updates::is_blocked(ctx).ok(),
        },
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum AvailableUpdate {
    Current { version: String },
    Ready { version: String },
    Unavailable { version: String, message: String },
}

pub fn check_update(ctx: &AppContext) -> Result<AvailableUpdate> {
    let current = installed(ctx)?.context("Spotify is not managed by Spicetify")?;
    let package = latest(current.channel)?;
    let actual = executable_version(&ctx.spotify_exec)?;
    if version_parts(&package.version)? <= version_parts(&actual)? {
        return Ok(AvailableUpdate::Current { version: package.version });
    }
    Ok(match verify_support(ctx, &package.version) {
        Ok(()) => AvailableUpdate::Ready { version: package.version },
        Err(error) => {
            AvailableUpdate::Unavailable { version: package.version, message: format!("{error:#}") }
        }
    })
}

fn status(ctx: &AppContext) -> Result<()> {
    let current = installed(ctx)?;
    if let Some(current) = &current {
        tracing::info!(
            "Managed Spotify {} ({}) at {}",
            current.version,
            current.channel.name(),
            ctx.spotify_data_dir.display()
        );
        tracing::info!("Executable version: {}", executable_version(&ctx.spotify_exec)?);
    } else {
        tracing::info!("Spotify at {} is not managed by Spicetify", ctx.spotify_exec.display());
    }
    match super::updates::is_blocked(ctx) {
        Ok(blocked) => {
            tracing::info!("Native update block: {}", if blocked { "blocked" } else { "allowed" });
        }
        Err(error) => tracing::info!("Native update block: unknown ({error})"),
    }
    let channel = current.as_ref().map_or(Channel::Stable, |i| i.channel);
    let package = latest(channel)?;
    tracing::info!("Latest official {} package: {}", channel.name(), package.version);
    Ok(())
}

fn latest(channel: Channel) -> Result<Package> {
    let url = format!("{ORIGIN}/dists/{}/non-free/binary-amd64/Packages", channel.name());
    let response = crate::http::blocking_client(30)?.get(url).send()?.error_for_status()?;
    let mut bytes = Vec::new();
    let _ = response.take(4 * 1024 * 1024 + 1).read_to_end(&mut bytes)?;
    ensure!(bytes.len() <= 4 * 1024 * 1024, "Spotify package index is too large");
    parse_package(std::str::from_utf8(&bytes)?)
}

fn parse_package(text: &str) -> Result<Package> {
    for paragraph in text.split("\n\n") {
        let fields: BTreeMap<_, _> =
            paragraph.lines().filter_map(|line| line.split_once(": ")).collect();
        if fields.get("Package") != Some(&"spotify-client")
            || fields.get("Architecture") != Some(&"amd64")
        {
            continue;
        }
        let get =
            |name| fields.get(name).copied().with_context(|| format!("package is missing {name}"));
        let raw = get("Version")?;
        let version = raw.split_once(':').map_or(raw, |(_, version)| version).to_string();
        ensure!(
            version.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.'),
            "invalid Spotify version"
        );
        let _ = version_parts(&version)?;
        let filename = get("Filename")?.to_string();
        ensure!(
            filename.starts_with("pool/non-free/s/spotify-client/")
                && filename.ends_with("_amd64.deb")
                && filename.split('/').all(|p| !p.is_empty() && p != "." && p != "..")
                && filename.bytes().all(|b| b.is_ascii_alphanumeric() || b"/_.-".contains(&b)),
            "invalid Spotify package path"
        );
        let sha256 = get("SHA256")?.to_ascii_lowercase();
        ensure!(
            sha256.len() == 64 && sha256.bytes().all(|b| b.is_ascii_hexdigit()),
            "invalid SHA256"
        );
        let size = get("Size")?.parse()?;
        ensure!((1..=MAX_PACKAGE_SIZE).contains(&size), "invalid Spotify package size");
        return Ok(Package { version, filename, sha256, size });
    }
    anyhow::bail!("Spotify's repository has no spotify-client package for amd64")
}

fn version_parts(version: &str) -> Result<[u64; 4]> {
    let parts: Vec<_> =
        version.split('.').take(4).map(str::parse).collect::<std::result::Result<_, _>>()?;
    parts.try_into().map_err(|_| anyhow::anyhow!("invalid Spotify version: {version}"))
}

fn version_line(version: &str) -> Result<String> {
    let [major, minor, patch, _] = version_parts(version)?;
    Ok(format!("{major}.{minor}.{patch}"))
}

fn ensure_no_downgrade(installed: &str, offered: &str) -> Result<()> {
    ensure!(
        version_parts(offered)? >= version_parts(installed)?,
        "refusing to downgrade Spotify {installed} to {offered}; select a newer channel with --channel testing"
    );
    Ok(())
}

fn verify_support(ctx: &AppContext, version: &str) -> Result<()> {
    use crate::module::{remote, stage};
    let line = version_line(version)?;
    let wanted = stage::classmap_key_for_version(&line).context("invalid classmap version")?;
    let selected = remote::fetch_classmap(&ctx.config_root, &wanted, false)?;
    let remote::IndexedClassmapFile::File(filename) =
        remote::indexed_classmap_file(&ctx.config_root, &selected)
    else {
        anyhow::bail!("no published classmap for Spotify {version}");
    };
    let path = ctx.config_root.join("classmaps").join(&selected).join(filename);
    let support = remote::classmap_support(&ctx.config_root, &selected, &path);
    ensure!(
        support.selected_spotify.as_deref() == Some(line.as_str()),
        "Spotify {version} has no verified classmap yet; leaving the current installation unchanged"
    );
    Ok(())
}

fn verify_archive(path: &Path, package: &Package) -> Result<()> {
    ensure!(fs::metadata(path)?.len() == package.size, "Spotify package size mismatch");
    let mut file = File::open(path)?;
    let mut hash = Sha256::new();
    let mut buf = [0; 8192];
    loop {
        let len = file.read(&mut buf)?;
        if len == 0 {
            break;
        }
        hash.update(buf.get(..len).context("invalid read size")?);
    }
    ensure!(hex::encode(hash.finalize()) == package.sha256, "Spotify package SHA256 mismatch");
    Ok(())
}

fn download(package: &Package) -> Result<PathBuf> {
    let cache = base_dirs()?.cache_dir().join("spicetify/spotify");
    fs::create_dir_all(&cache)?;
    let path = cache.join(format!("{}.deb", package.sha256));
    if path.is_file() && verify_archive(&path, package).is_ok() {
        return Ok(path);
    }
    tracing::info!("Downloading Spotify {} ({} MB)", package.version, package.size / 1_000_000);
    let partial = cache.join(format!("{}.part", nonce()?));
    let result = (|| {
        let response = reqwest::blocking::Client::builder()
            .https_only(true)
            .timeout(std::time::Duration::from_secs(300))
            .build()?
            .get(format!("{ORIGIN}/{}", package.filename))
            .send()?
            .error_for_status()?;
        let mut file = File::create(&partial)?;
        let _ = std::io::copy(&mut response.take(package.size + 1), &mut file)?;
        file.sync_all()?;
        verify_archive(&partial, package)?;
        fs::rename(&partial, &path)?;
        Ok(path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(partial);
    }
    result
}

fn extract_deb(path: &Path, destination: &Path) -> Result<()> {
    let mut file = File::open(path)?;
    let length = file.metadata()?.len();
    let mut magic = [0; 8];
    file.read_exact(&mut magic)?;
    ensure!(&magic == b"!<arch>\n", "invalid Debian archive");
    while file.stream_position()? < length {
        let mut header = [0; 60];
        file.read_exact(&mut header)?;
        ensure!(&header[58..] == b"`\n", "invalid Debian member header");
        let name = std::str::from_utf8(&header[..16])?.trim().trim_end_matches('/');
        let size: u64 = std::str::from_utf8(&header[48..58])?.trim().parse()?;
        let start = file.stream_position()?;
        let end = start.checked_add(size).context("Debian member size overflow")?;
        ensure!(end <= length, "truncated Debian archive");
        if name.starts_with("data.tar") {
            let data = (&mut file).take(size);
            return match name {
                "data.tar.gz" => extract_tar(flate2::read::GzDecoder::new(data), destination),
                "data.tar.zst" => extract_tar(zstd::stream::read::Decoder::new(data)?, destination),
                "data.tar" => extract_tar(data, destination),
                _ => anyhow::bail!("unsupported Debian payload compression: {name}"),
            };
        }
        let _ = file.seek(SeekFrom::Start(end + size % 2))?;
    }
    anyhow::bail!("Debian package has no data archive")
}

fn extract_tar(reader: impl Read, destination: &Path) -> Result<()> {
    let mut total = 0_u64;
    for entry in tar::Archive::new(reader).entries()? {
        let mut entry = entry?;
        let path = entry.path()?.into_owned();
        ensure!(
            path.components().all(|c| matches!(c, Component::Normal(_) | Component::CurDir)),
            "unsafe archive path: {}",
            path.display()
        );
        let normalized: PathBuf =
            path.components().filter(|c| !matches!(c, Component::CurDir)).collect();
        let Ok(relative) = normalized.strip_prefix("usr/share/spotify") else {
            continue;
        };
        if relative.as_os_str().is_empty() {
            continue;
        }
        let kind = entry.header().entry_type();
        ensure!(kind.is_file() || kind.is_dir(), "unsupported archive entry: {}", path.display());
        total = total.checked_add(entry.size()).context("archive size overflow")?;
        ensure!(total <= 2 * 1024 * 1024 * 1024, "expanded Spotify package is too large");
        let target = destination.join(relative);
        fs::create_dir_all(target.parent().context("archive path has no parent")?)?;
        let _ = entry.unpack(&target)?;
        if kind.is_file() {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(
                &target,
                fs::Permissions::from_mode(entry.header().mode()? & 0o777),
            )?;
        }
    }
    ensure!(
        destination.join("spotify").is_file() && destination.join("Apps/xpui.spa").is_file(),
        "package is missing Spotify's executable or UI archive"
    );
    Ok(())
}

fn check_dependencies(dir: &Path) -> Result<()> {
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path.file_name().is_none_or(|name| name != "spotify")
            && path.extension().is_none_or(|extension| extension != "so")
        {
            continue;
        }
        let output = Command::new("ldd")
            .arg(&path)
            .output()
            .context("ldd is required to check Spotify's runtime libraries")?;
        let text = format!(
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        let missing: Vec<_> = text.lines().filter(|line| line.contains("not found")).collect();
        ensure!(
            output.status.success() && missing.is_empty(),
            "Spotify runtime dependencies are missing for {}:\n{}\nInstall these libraries with your system package manager, then retry.",
            path.display(),
            missing.join("\n")
        );
    }
    Ok(())
}

fn executable_version(path: &Path) -> Result<String> {
    let output = Command::new(path).arg("--version").output()?;
    ensure!(
        output.status.success(),
        "Spotify cannot run: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    );
    let text = String::from_utf8(output.stdout)?;
    parse_executable_version(&text)
}

fn parse_executable_version(text: &str) -> Result<String> {
    text.split_whitespace()
        .map(|word| word.trim_end_matches(','))
        .find(|word| version_parts(word).is_ok())
        .map(str::to_string)
        .context("Spotify did not report its version")
}

fn nonce() -> Result<String> {
    let mut bytes = [0; 8];
    getrandom::fill(&mut bytes)?;
    Ok(hex::encode(bytes))
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path.parent().context("file has no parent")?;
    fs::create_dir_all(parent)?;
    let temp = parent.join(format!(".spicetify-{}", nonce()?));
    let result = (|| {
        let mut file = File::create(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&temp, path)?;
        File::open(parent)?.sync_all()?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temp);
    }
    result
}

fn desktop_entry(exec: &Path, icon: &Path) -> Result<String> {
    let escape = |path: &Path| -> Result<String> {
        let value = path.to_str().context("desktop launcher path is not UTF-8")?;
        ensure!(!value.contains(['\n', '\r']), "desktop launcher path contains a newline");
        Ok(value
            .replace('\\', "\\\\\\\\")
            .replace('"', "\\\\\"")
            .replace('`', "\\\\`")
            .replace('$', "\\\\$")
            .replace('%', "%%"))
    };
    let exec = escape(exec)?;
    let icon = icon.to_str().context("icon path is not UTF-8")?;
    ensure!(!icon.contains(['\n', '\r']), "icon path contains a newline");
    Ok(format!(
        "[Desktop Entry]\nType=Application\nName=Spotify\nComment=Listen to music\nExec=\"{exec}\" %U\nIcon={}\nTerminal=false\nCategories=Audio;Music;Player;AudioVideo;\nMimeType=x-scheme-handler/spotify;\nStartupWMClass=spotify\n",
        icon.replace('\\', "\\\\")
    ))
}

fn read_optional(path: &Path) -> Result<Option<Vec<u8>>> {
    match fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

fn restore_file(path: &Path, previous: Option<&[u8]>) -> Result<()> {
    if let Some(bytes) = previous {
        atomic_write(path, bytes)
    } else {
        match fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error.into()),
        }
    }
}

fn replace_and_activate(
    files: &[(&Path, &[u8])],
    launch: impl FnOnce() -> Result<()>,
) -> Result<()> {
    let previous = files.iter().map(|(path, _)| read_optional(path)).collect::<Result<Vec<_>>>()?;
    let result = (|| {
        for (path, bytes) in files {
            atomic_write(path, bytes)?;
        }
        launch()
    })();
    if let Err(error) = result {
        let mut failures = Vec::new();
        for ((path, _), previous) in files.iter().zip(&previous) {
            if let Err(error) = restore_file(path, previous.as_deref()) {
                failures.push(format!("{}: {error}", path.display()));
            }
        }
        ensure!(
            failures.is_empty(),
            "activation failed: {error:#}; recovery failed: {}",
            failures.join("; ")
        );
        return Err(error);
    }
    Ok(())
}

fn recovery_error(
    original: anyhow::Error,
    steps: impl IntoIterator<Item = (&'static str, Result<()>)>,
) -> anyhow::Error {
    let failures: Vec<_> = steps
        .into_iter()
        .filter_map(|(step, result)| result.err().map(|error| format!("{step}: {error:#}")))
        .collect();
    if failures.is_empty() {
        original.context("installation failed; restored the previous Spotify configuration")
    } else {
        original
            .context(format!("installation failed; recovery incomplete: {}", failures.join("; ")))
    }
}

fn activate(
    old: &AppContext,
    next: &AppContext,
    config: &Config,
    candidate: &Path,
    manage_daemon: bool,
) -> Result<()> {
    let launcher = base_dirs()?.data_dir().join("applications/spotify.desktop");
    let previous_config = read_optional(&old.config_file)?;
    let previous_launcher = read_optional(&launcher)?;
    let terminal = terminal_launcher()?;
    let previous_terminal = read_launcher_link(&terminal)?;
    let desktop =
        desktop_entry(&next.spotify_exec, &candidate.join("icons/spotify-linux-128.png"))?;
    let config_bytes = toml::to_string_pretty(config)?.into_bytes();
    if let Some(bytes) = &previous_config {
        fs::write(candidate.join("config-before.toml"), bytes)?;
    }
    if let Some(bytes) = &previous_launcher {
        fs::write(candidate.join("desktop-before.desktop"), bytes)?;
    }
    let was_running = crate::lifecycle::is_running(old);
    let daemon_running = crate::daemon::is_daemon_running();
    let daemon_installed = crate::daemon::DaemonManager::create().is_installed();
    if manage_daemon {
        super::daemon::stop()?;
    }
    let result = (|| {
        ensure!(
            !manage_daemon || !crate::daemon::is_daemon_running(),
            "daemon did not stop before changing Spotify paths"
        );
        crate::lifecycle::stop(old)?;
        ensure!(!crate::lifecycle::is_running(old), "Spotify did not stop before installation");
        replace_and_activate(
            &[(&old.config_file, &config_bytes), (&launcher, desktop.as_bytes())],
            || {
                replace_launcher_link(&terminal, Some(&next.spotify_exec))?;
                super::updates::reassert_block(next);
                if let Ok(blocked) = super::updates::is_blocked(next) {
                    ensure!(
                        next.block_spotify_updates != Some(true) || blocked,
                        "could not preserve the requested native update block"
                    );
                    let path = next.spotify_apps_path().join("xpui/modules/manifest.json");
                    let mut manifest: serde_json::Value =
                        serde_json::from_slice(&fs::read(&path)?)?;
                    let object = manifest.as_object_mut().context("invalid prepared manifest")?;
                    let _ = object.insert("updatesBlocked".into(), blocked.into());
                    atomic_write(&path, &serde_json::to_vec_pretty(&manifest)?)?;
                }
                crate::lifecycle::start(next)
            },
        )
    })();
    if let Err(error) = result {
        // Evaluate every compensation, even when an earlier one fails.
        let recovery = [
            ("stop candidate", crate::lifecycle::stop(next)),
            ("restore configuration", restore_file(&old.config_file, previous_config.as_deref())),
            ("restore launcher", restore_file(&launcher, previous_launcher.as_deref())),
            (
                "restore terminal launcher",
                replace_launcher_link(&terminal, previous_terminal.as_deref()),
            ),
            (
                "restart previous client",
                if was_running { crate::lifecycle::start(old) } else { Ok(()) },
            ),
            (
                "restore daemon service",
                if manage_daemon && daemon_installed { super::daemon::install() } else { Ok(()) },
            ),
            (
                "restart daemon",
                if manage_daemon && daemon_running && !crate::daemon::is_daemon_running() {
                    super::daemon::start()
                } else {
                    Ok(())
                },
            ),
        ];
        return Err(recovery_error(error, recovery));
    }
    if manage_daemon {
        super::apply::ensure_daemon(next);
        crate::platform::register_url_scheme();
    }
    if let Some(directory) = launcher.parent() {
        let _ = Command::new("update-desktop-database").arg(directory).output();
    }
    check_terminal_path(next);
    Ok(())
}

fn terminal_launcher() -> Result<PathBuf> {
    Ok(base_dirs()?.home_dir().join(".local/bin/spotify"))
}

fn read_launcher_link(path: &Path) -> Result<Option<PathBuf>> {
    match fs::read_link(path) {
        Ok(target) => Ok(Some(target)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error).with_context(|| format!("cannot replace {}; move the existing file aside to use the managed Spotify launcher", path.display())),
    }
}

fn replace_launcher_link(path: &Path, target: Option<&Path>) -> Result<()> {
    let Some(target) = target else { return restore_file(path, None) };
    let parent = path.parent().context("launcher has no parent")?;
    fs::create_dir_all(parent)?;
    let temporary = parent.join(format!(".spotify-{}", nonce()?));
    std::os::unix::fs::symlink(target, &temporary)?;
    if let Err(error) = fs::rename(&temporary, path) {
        let _ = fs::remove_file(temporary);
        return Err(error.into());
    }
    Ok(())
}

fn repair_launchers(ctx: &AppContext) -> Result<()> {
    let terminal = terminal_launcher()?;
    let previous = read_launcher_link(&terminal)?;
    let desktop = base_dirs()?.data_dir().join("applications/spotify.desktop");
    let content = desktop_entry(
        &ctx.spotify_exec,
        &ctx.spotify_data_dir.join("icons/spotify-linux-128.png"),
    )?;
    let result = replace_and_activate(&[(&desktop, content.as_bytes())], || {
        replace_launcher_link(&terminal, Some(&ctx.spotify_exec))
    });
    if let Err(error) = result {
        return Err(recovery_error(
            error,
            [("restore terminal launcher", replace_launcher_link(&terminal, previous.as_deref()))],
        ));
    }
    check_terminal_path(ctx);
    Ok(())
}

fn terminal_path_selects(path: &std::ffi::OsStr, executable: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    let Ok(expected) = executable.canonicalize() else { return false };
    let selected =
        std::env::split_paths(path).map(|directory| directory.join("spotify")).find(|candidate| {
            fs::metadata(candidate).is_ok_and(|metadata| {
                metadata.is_file() && metadata.permissions().mode() & 0o111 != 0
            })
        });
    selected.and_then(|candidate| candidate.canonicalize().ok()) == Some(expected)
}

fn check_terminal_path(ctx: &AppContext) {
    if !std::env::var_os("PATH").is_some_and(|path| terminal_path_selects(&path, &ctx.spotify_exec))
    {
        tracing::warn!(
            "The terminal command does not select managed Spotify. Put ~/.local/bin before other Spotify directories in your shell's PATH and reopen your terminal. The desktop launcher already selects the managed copy."
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn terminal_launcher_switch_and_rollback_preserve_the_previous_target() {
        let dir = Fixture::new();
        let launcher = dir.0.join("bin/spotify");
        let first = dir.0.join("old client/spotify");
        let second = dir.0.join("new client/spotify");
        assert!(read_launcher_link(&launcher).expect("missing launcher").is_none());
        replace_launcher_link(&launcher, Some(&first)).expect("initial launcher");
        let previous = read_launcher_link(&launcher).expect("snapshot");
        replace_launcher_link(&launcher, Some(&second)).expect("switch launcher");
        assert_eq!(fs::read_link(&launcher).expect("target"), second);
        replace_launcher_link(&launcher, previous.as_deref()).expect("restore launcher");
        assert_eq!(fs::read_link(&launcher).expect("restored target"), first);
        replace_launcher_link(&launcher, None).expect("remove new launcher");
        fs::write(&launcher, b"user script").expect("user launcher");
        assert!(read_launcher_link(&launcher).is_err());
        assert_eq!(fs::read(&launcher).expect("user file preserved"), b"user script");
    }

    #[test]
    fn terminal_path_check_detects_missing_or_shadowed_managed_launchers() {
        use std::os::unix::fs::PermissionsExt;
        let dir = Fixture::new();
        let user = dir.0.join("user-bin");
        let system = dir.0.join("system-bin");
        fs::create_dir_all(&user).expect("user bin");
        fs::create_dir_all(&system).expect("system bin");
        for parent in [&user, &system] {
            let executable = parent.join("spotify");
            fs::write(&executable, b"#!/bin/sh\nexit 0\n").expect("executable");
            fs::set_permissions(&executable, fs::Permissions::from_mode(0o755))
                .expect("permissions");
        }
        let target = user.join("spotify");
        assert!(terminal_path_selects(
            &std::env::join_paths([&user, &system]).expect("PATH"),
            &target
        ));
        assert!(!terminal_path_selects(
            &std::env::join_paths([&system, &user]).expect("PATH"),
            &target
        ));
        assert!(!terminal_path_selects(&std::env::join_paths([&system]).expect("PATH"), &target));
    }

    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("spicetify-installer-{}", nonce().unwrap()));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn metadata() -> String {
        format!(
            "Package: spotify-client\nArchitecture: amd64\nVersion: 1:1.2.96.518.g366879e1\nFilename: pool/non-free/s/spotify-client/spotify-client_1.2.96.518.g366879e1_amd64.deb\nSize: 3\nSHA256: {}\n",
            hex::encode(Sha256::digest(b"abc"))
        )
    }

    #[test]
    fn reads_official_metadata_and_rejects_unsafe_or_incomplete_entries() {
        let raw = metadata();
        let package = parse_package(&raw).unwrap();
        assert_eq!(package.version, "1.2.96.518.g366879e1");
        assert!(parse_package(&raw.replace("Architecture: amd64", "Architecture: arm64")).is_err());
        assert!(parse_package(&raw.replace("pool/non-free/", "https://evil.invalid/")).is_err());
        assert!(parse_package(&raw.replace("s/spotify-client/", "s/../")).is_err());
        assert!(parse_package(&raw.replace("Size: 3", "Size: 999999999999")).is_err());
        assert!(parse_package(&raw.replace("SHA256:", "Missing:")).is_err());
    }

    #[test]
    fn verifies_size_and_hash_even_for_cached_packages() {
        let dir = Fixture::new();
        let path = dir.0.join("package.deb");
        let package = parse_package(&metadata()).unwrap();
        fs::write(&path, b"abc").unwrap();
        verify_archive(&path, &package).unwrap();
        fs::write(&path, b"abd").unwrap();
        assert!(verify_archive(&path, &package).unwrap_err().to_string().contains("SHA256"));
        fs::write(&path, b"ab").unwrap();
        assert!(verify_archive(&path, &package).unwrap_err().to_string().contains("size"));
    }

    #[test]
    fn compares_numeric_versions_including_builds() {
        assert!(ensure_no_downgrade("1.2.96.518.gabc", "1.2.95.999.gdef").is_err());
        assert!(ensure_no_downgrade("1.2.96.518.gabc", "1.2.96.517.gdef").is_err());
        ensure_no_downgrade("1.2.96.518.gabc", "1.2.100.1.gdef").unwrap();
        assert_eq!(version_line("1.2.96.518.gabc").unwrap(), "1.2.96");
        assert_eq!(
            parse_executable_version(
                "Spotify version 1.2.96.518.g366879e1, Copyright (c) 2026, Spotify Ltd"
            )
            .unwrap(),
            "1.2.96.518.g366879e1"
        );
    }

    fn tar_file(builder: &mut tar::Builder<Vec<u8>>, path: &str, content: &[u8]) {
        let mut header = tar::Header::new_gnu();
        header.set_size(content.len() as u64);
        header.set_mode(0o4755);
        header.set_cksum();
        builder.append_data(&mut header, path, content).unwrap();
    }

    fn payload(link: bool) -> Vec<u8> {
        let mut builder = tar::Builder::new(Vec::new());
        tar_file(&mut builder, "./usr/share/spotify/spotify", b"executable");
        tar_file(&mut builder, "usr/share/spotify/Apps/xpui.spa", b"UI");
        tar_file(&mut builder, "usr/bin/spotify", b"not installed system-wide");
        if link {
            let mut header = tar::Header::new_gnu();
            header.set_entry_type(tar::EntryType::Symlink);
            header.set_size(0);
            header.set_mode(0o777);
            builder.append_link(&mut header, "usr/share/spotify/escape", "/tmp").unwrap();
        }
        builder.into_inner().unwrap()
    }

    #[test]
    fn extracts_only_client_files_without_special_permissions_or_links() {
        use std::os::unix::fs::PermissionsExt;
        let dir = Fixture::new();
        extract_tar(&payload(false)[..], &dir.0).unwrap();
        assert_eq!(fs::read(dir.0.join("spotify")).unwrap(), b"executable");
        assert_eq!(
            fs::metadata(dir.0.join("spotify")).unwrap().permissions().mode() & 0o7777,
            0o755
        );
        assert!(!dir.0.join("usr").exists());
        assert!(extract_tar(&payload(true)[..], &Fixture::new().0).is_err());
    }

    #[test]
    fn reads_gzipped_debian_payload_and_rejects_truncation() {
        let dir = Fixture::new();
        let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        encoder.write_all(&payload(false)).unwrap();
        let data = encoder.finish().unwrap();
        let header = format!(
            "{:<16}{:<12}{:<6}{:<6}{:<8}{:<10}`\n",
            "data.tar.gz",
            "0",
            "0",
            "0",
            "644",
            data.len()
        );
        let mut deb = b"!<arch>\n".to_vec();
        deb.extend_from_slice(header.as_bytes());
        deb.extend_from_slice(&data);
        let path = dir.0.join("spotify.deb");
        fs::write(&path, &deb).unwrap();
        let dest = dir.0.join("client");
        fs::create_dir(&dest).unwrap();
        extract_deb(&path, &dest).unwrap();
        assert!(dest.join("Apps/xpui.spa").is_file());
        deb.truncate(deb.len() - 10);
        fs::write(&path, deb).unwrap();
        assert!(extract_deb(&path, &dest).is_err());
    }

    #[test]
    fn launch_failure_restores_both_files_and_removes_new_files() {
        let dir = Fixture::new();
        let config = dir.0.join("config.toml");
        let desktop = dir.0.join("spotify.desktop");
        fs::write(&config, b"previous config").unwrap();
        let result =
            replace_and_activate(&[(&config, b"new config"), (&desktop, b"new desktop")], || {
                assert_eq!(fs::read(&config).unwrap(), b"new config");
                assert!(desktop.exists());
                anyhow::bail!("simulated launch failure")
            });
        assert!(result.is_err());
        assert_eq!(fs::read(&config).unwrap(), b"previous config");
        assert!(!desktop.exists());
        replace_and_activate(&[(&config, b"new config"), (&desktop, b"new desktop")], || Ok(()))
            .unwrap();
        assert_eq!(fs::read(desktop).unwrap(), b"new desktop");
    }

    #[test]
    fn recovery_attempts_every_step_and_preserves_all_errors() {
        let mut attempted = Vec::new();
        let steps = ["configuration", "launcher", "daemon", "previous client"];
        let recovery = steps.into_iter().map(|step| {
            attempted.push(step);
            let result = match step {
                "configuration" => Err(anyhow::anyhow!("configuration write failed")),
                "daemon" => Err(anyhow::anyhow!("daemon spawn failed")),
                _ => Ok(()),
            };
            (step, result)
        });
        let error = recovery_error(anyhow::anyhow!("candidate launch failed"), recovery);
        assert_eq!(attempted, steps, "a failed compensation must not skip later recovery");
        let message = format!("{error:#}");
        assert!(message.contains("configuration write failed"));
        assert!(message.contains("daemon spawn failed"));
        assert!(message.contains("candidate launch failed"));
        assert!(message.contains("recovery incomplete"));
    }

    #[test]
    fn launcher_quotes_paths_and_keeps_only_the_intended_field_code() {
        let text =
            desktop_entry(Path::new("/tmp/a b/$x%y/spotify"), Path::new("/tmp/icon.png")).unwrap();
        assert!(text.contains("Exec=\"/tmp/a b/\\\\$x%%y/spotify\" %U"));
        assert!(desktop_entry(Path::new("/tmp/a\nBad=1"), Path::new("/tmp/icon.png")).is_err());
    }
}
