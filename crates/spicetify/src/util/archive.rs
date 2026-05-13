use std::{
    fs::{self, File}, io::{self, Cursor}, path::Path
};

use anyhow::{Context, Result, bail};
use crate::i18n;
use flate2::read::GzDecoder;
use tar::Archive;
use zip::ZipArchive;

pub fn unzip_file(zip_path: &Path, dest: &Path) -> Result<()> {
    let file = File::open(zip_path)?;
    let mut zip = ZipArchive::new(file)?;
    extract_zip(&mut zip, dest)
}

pub fn extract_zip<R: io::Read + io::Seek>(zip: &mut ZipArchive<R>, dest: &Path) -> Result<()> {
    fs::create_dir_all(dest)?;
    let dest = dunce::canonicalize(dest)?;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i)?;

        let out = dunce::canonicalize(dest.join(entry.name())).unwrap_or_else(|_| {
            let mut clean = std::path::PathBuf::new();
            for c in dest.join(entry.name()).components() {
                if c != std::path::Component::ParentDir {
                    clean.push(c);
                }
            }
            clean
        });

        if !out.starts_with(&dest) {
            bail!(i18n::lookup("illegal_zip_path"));
        }

        if entry.is_dir() {
            fs::create_dir_all(&out)?;
            continue;
        }

        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent)?;
        }

        io::copy(
            &mut entry,
            &mut File::create(&out)
                .with_context(|| i18n::lookup_with_args("failed_creating_file", &[("path", &out.display().to_string())]))?,
        )?;
    }
    Ok(())
}

pub fn untar_gz_bytes(bytes: &[u8], dest: &Path) -> Result<()> {
    let gz = GzDecoder::new(Cursor::new(bytes));
    let mut tar = Archive::new(gz);
    fs::create_dir_all(dest)?;
    tar.unpack(dest)?;
    Ok(())
}
