use std::fs::File;
use std::path::Path;

use zip::ZipArchive;

use super::ArchiveError;

pub(crate) fn unzip_file(src: &Path, dest: &Path) -> Result<(), ArchiveError> {
    let file = File::open(src)?;
    let mut archive = ZipArchive::new(file)?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let raw_name = entry.name().to_string();
        let safe = safe_relative_path(&raw_name)?;
        let outpath = dest.join(safe);
        if entry.is_dir() {
            std::fs::create_dir_all(&outpath)?;
            continue;
        }
        if let Some(parent) = outpath.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut out = File::create(&outpath)?;
        std::io::copy(&mut entry, &mut out).map(|_| ())?;
    }
    Ok(())
}

pub(crate) fn untar_zst_bytes(bytes: &[u8], dest: &Path) -> Result<(), ArchiveError> {
    let zst = zstd::Decoder::new(bytes)?;
    let mut archive = tar::Archive::new(zst);
    archive.unpack(dest)?;
    Ok(())
}

fn safe_relative_path(name: &str) -> Result<std::path::PathBuf, ArchiveError> {
    use std::path::PathBuf;
    let path = PathBuf::from(name.replace('\\', "/"));
    if path.is_absolute() {
        return Err(ArchiveError::IllegalPath(name.to_string()));
    }
    for component in path.components() {
        use std::path::Component;
        if matches!(component, Component::ParentDir) {
            return Err(ArchiveError::IllegalPath(name.to_string()));
        }
    }
    Ok(path)
}
