use serde::Deserialize;
use sha2::{Digest, Sha256};

#[derive(Debug, Clone, Deserialize)]
pub struct ReleaseAsset {
    pub name: String,
    pub browser_download_url: String,
    #[serde(default)]
    pub size: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReleaseInfo {
    pub tag_name: String,
    // GitHub sends explicit `null` for a release created without a name or
    // body (every workflow-cut v3 release), and `#[serde(default)]` alone
    // only covers a MISSING field, so both need the null-tolerant path.
    #[serde(default, deserialize_with = "null_as_default")]
    pub name: String,
    #[serde(default, deserialize_with = "null_as_default")]
    pub body: String,
    #[serde(default)]
    pub assets: Vec<ReleaseAsset>,
}

fn null_as_default<'de, D: serde::Deserializer<'de>>(deserializer: D) -> Result<String, D::Error> {
    Ok(Option::<String>::deserialize(deserializer)?.unwrap_or_default())
}

impl ReleaseInfo {
    #[must_use]
    pub fn version(&self) -> String {
        self.tag_name.trim_start_matches('v').to_string()
    }

    #[must_use]
    pub fn find_platform_asset(&self, arch: &str) -> Option<&ReleaseAsset> {
        let candidates = candidate_asset_names(&self.version(), arch);
        for name in &candidates {
            if let Some(asset) = self.assets.iter().find(|a| a.name == *name) {
                return Some(asset);
            }
        }
        None
    }

    #[must_use]
    pub fn find_checksum_asset(&self, asset_name: &str) -> Option<&ReleaseAsset> {
        let checksum_names = [format!("{asset_name}.sha256"), format!("{asset_name}.sha256sum")];
        for name in &checksum_names {
            if let Some(asset) = self.assets.iter().find(|a| a.name == *name) {
                return Some(asset);
            }
        }
        None
    }
}

#[must_use]
pub fn candidate_asset_names(version: &str, arch: &str) -> Vec<String> {
    candidate_asset_names_for(version, std::env::consts::OS, arch)
}

fn candidate_asset_names_for(version: &str, os: &str, arch: &str) -> Vec<String> {
    let ext = if os == "windows" { "zip" } else { "tar.zst" };
    let mut names = Vec::new();

    names.push(format!("spicetify-{version}-{os}-{arch}.{ext}"));

    let short_arch = short_arch_name(arch);
    if short_arch != arch {
        names.push(format!("spicetify-{version}-{os}-{short_arch}.{ext}"));
    }

    names.push(format!("portable-spicetify-{version}-{short_arch}.{ext}"));

    names
}

fn preferred_arch(
    os: &str,
    process_arch: &'static str,
    native_machine: Option<u16>,
    spotify_machine: Option<u16>,
) -> &'static str {
    if os == "windows" && native_machine == Some(0xaa64) {
        if spotify_machine == Some(0x8664) { "x86_64" } else { "aarch64" }
    } else {
        process_arch
    }
}

#[must_use]
pub fn platform_arch(ctx: &crate::context::AppContext) -> &'static str {
    #[cfg(not(windows))]
    let _ = ctx;
    #[cfg(windows)]
    let native_machine = {
        use windows::Win32::System::SystemInformation::IMAGE_FILE_MACHINE;
        use windows::Win32::System::Threading::{GetCurrentProcess, IsWow64Process2};
        let mut process = IMAGE_FILE_MACHINE::default();
        let mut native = IMAGE_FILE_MACHINE::default();
        // GetNativeSystemInfo reports the emulated architecture on Windows ARM64.
        // SAFETY: the current-process pseudo-handle is valid and both outputs are writable.
        #[allow(unsafe_code)]
        match unsafe {
            IsWow64Process2(GetCurrentProcess(), &raw mut process, Some(&raw mut native))
        } {
            Ok(()) => Some(native.0),
            Err(error) => {
                tracing::warn!(%error, "could not detect native Windows architecture");
                None
            }
        }
    };
    #[cfg(not(windows))]
    let native_machine = None;
    #[cfg(windows)]
    let spotify_machine = if native_machine == Some(0xaa64) {
        // Store's launch alias is not the PE file; its data directory holds the real binary.
        [ctx.spotify_exec.clone(), ctx.spotify_data_dir.join("Spotify.exe")].iter().find_map(
            |path| {
                let mut file = std::fs::File::open(path).ok()?;
                pe_machine(&mut file).ok()
            },
        )
    } else {
        None
    };
    #[cfg(not(windows))]
    let spotify_machine = None;
    preferred_arch(std::env::consts::OS, std::env::consts::ARCH, native_machine, spotify_machine)
}

#[cfg(any(windows, test))]
fn pe_machine(reader: &mut (impl std::io::Read + std::io::Seek)) -> std::io::Result<u16> {
    let mut dos = [0; 64];
    reader.read_exact(&mut dos)?;
    if &dos[..2] != b"MZ" {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "missing DOS header"));
    }
    let offset = u32::from_le_bytes(dos[60..64].try_into().expect("four-byte PE offset"));
    let _ = reader.seek(std::io::SeekFrom::Start(u64::from(offset)))?;
    let mut pe = [0; 6];
    reader.read_exact(&mut pe)?;
    if &pe[..4] != b"PE\0\0" {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "missing PE header"));
    }
    Ok(u16::from_le_bytes([pe[4], pe[5]]))
}

#[must_use]
pub fn short_arch_name(arch: &str) -> &str {
    match arch {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        _ => arch,
    }
}

#[must_use]
pub fn binary_name() -> &'static str {
    if cfg!(windows) { "spicetify.exe" } else { "spicetify" }
}

pub fn compute_sha256(path: &std::path::Path) -> std::io::Result<String> {
    let bytes = std::fs::read(path)?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    Ok(hex::encode(hasher.finalize()))
}

pub fn verify_checksum(path: &std::path::Path, expected: &str) -> Result<(), ChecksumError> {
    let actual = compute_sha256(path).map_err(ChecksumError::Io)?;
    if actual != expected {
        return Err(ChecksumError::Mismatch { expected: expected.to_string(), actual });
    }
    Ok(())
}

#[derive(Debug, thiserror::Error)]
pub enum ChecksumError {
    #[error("checksum mismatch: expected {expected}, got {actual}")]
    Mismatch { expected: String, actual: String },
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emulated_windows_selects_native_arm64_release_assets() {
        let arch = preferred_arch("windows", "x86_64", Some(0xaa64), Some(0xaa64));
        let names = candidate_asset_names_for("3.0.0-beta.20", "windows", arch);
        assert_eq!(names[0], "spicetify-3.0.0-beta.20-windows-aarch64.zip");
        assert!(!names.iter().any(|name| name.contains("x86_64") || name.contains("x64")));
    }

    #[test]
    fn native_windows_and_other_platforms_keep_their_architecture() {
        assert_eq!(preferred_arch("windows", "x86_64", Some(0x8664), Some(0x8664)), "x86_64");
        assert_eq!(preferred_arch("windows", "aarch64", Some(0xaa64), Some(0xaa64)), "aarch64");
        assert_eq!(preferred_arch("macos", "x86_64", None, None), "x86_64");
        assert_eq!(preferred_arch("linux", "aarch64", None, None), "aarch64");
    }

    #[test]
    fn arm64_windows_preserves_x64_spotify_and_defaults_to_native_before_install() {
        for process_arch in ["x86_64", "aarch64"] {
            assert_eq!(
                preferred_arch("windows", process_arch, Some(0xaa64), Some(0x8664)),
                "x86_64"
            );
            assert_eq!(
                preferred_arch("windows", process_arch, Some(0xaa64), Some(0xaa64)),
                "aarch64"
            );
            assert_eq!(preferred_arch("windows", process_arch, Some(0xaa64), None), "aarch64");
        }
    }

    #[test]
    fn spotify_architecture_comes_from_the_pe_header() {
        for machine in [0xaa64u16, 0x8664] {
            let mut bytes = vec![0; 134];
            bytes[..2].copy_from_slice(b"MZ");
            bytes[60..64].copy_from_slice(&128u32.to_le_bytes());
            bytes[128..132].copy_from_slice(b"PE\0\0");
            bytes[132..134].copy_from_slice(&machine.to_le_bytes());
            assert_eq!(pe_machine(&mut std::io::Cursor::new(&bytes)).unwrap(), machine);
            bytes[128] = 0;
            assert!(pe_machine(&mut std::io::Cursor::new(&bytes)).is_err());
        }
        assert!(pe_machine(&mut std::io::Cursor::new(b"not an executable")).is_err());
    }

    #[test]
    fn deserializes_the_real_release_list_shape() {
        // Trimmed from the live GitHub API: workflow-cut releases carry
        // explicit nulls for name and body, which is what broke the first
        // list-based self-update in the field.
        let json = r#"[
            {"tag_name": "v3.0.0-beta.8", "name": null, "body": null,
             "assets": [{"name": "spicetify-3.0.0-beta.8-macos-aarch64.tar.gz",
                         "browser_download_url": "https://example.com/a.tar.gz", "size": 1}]},
            {"tag_name": "v2.44.0", "name": "v2.44.0", "body": "notes", "assets": []}
        ]"#;
        let releases: Vec<ReleaseInfo> = serde_json::from_str(json).expect("null fields tolerated");
        assert_eq!(releases.len(), 2);
        assert_eq!(releases[0].version(), "3.0.0-beta.8");
        assert_eq!(releases[0].name, "");
        assert_eq!(releases[1].body, "notes");
    }
}
