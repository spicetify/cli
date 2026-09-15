use std::fs::File;
use std::io::{Cursor, Read, Seek};
use std::path::Path;

use zip::ZipArchive;

use super::ArchiveError;

pub(crate) fn unzip_file(src: &Path, dest: &Path) -> Result<(), ArchiveError> {
    unzip(File::open(src)?, dest)
}

pub(crate) fn unzip_bytes(bytes: &[u8], dest: &Path) -> Result<(), ArchiveError> {
    unzip(Cursor::new(bytes), dest)
}

fn unzip(reader: impl Read + Seek, dest: &Path) -> Result<(), ArchiveError> {
    let mut archive = ZipArchive::new(reader)?;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let raw_name = entry.name().to_string();
        // Spotify 1.3 archives contain an explicit `/` directory entry before
        // their relative files. It names the archive root, not an extraction
        // target; keep rejecting every other absolute path.
        if entry.is_dir()
            && !raw_name.is_empty()
            && raw_name.bytes().all(|byte| matches!(byte, b'/' | b'\\'))
        {
            continue;
        }
        let safe = safe_relative_path(&raw_name)?;
        super::link::ensure_no_links(dest, &safe)?;
        let outpath = dest.join(safe);
        if entry.is_dir() {
            std::fs::create_dir_all(&outpath)?;
            continue;
        }
        if let Some(parent) = outpath.parent() {
            std::fs::create_dir_all(parent)?;
        }
        // Replace the directory entry, never truncate a possibly hard-linked
        // inode. Exclusive creation also refuses a new link at the leaf.
        if let Err(e) = std::fs::remove_file(&outpath)
            && e.kind() != std::io::ErrorKind::NotFound
        {
            return Err(e.into());
        }
        let mut out = File::create_new(&outpath)?;
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
    if path.is_absolute() || path.has_root() {
        return Err(ArchiveError::IllegalPath(name.to_string()));
    }
    for component in path.components() {
        use std::path::Component;
        if matches!(component, Component::ParentDir) {
            return Err(ArchiveError::IllegalPath(name.to_string()));
        }
    }
    Ok(path
        .components()
        .filter(|component| !matches!(component, std::path::Component::CurDir))
        .collect())
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use super::*;

    #[test]
    fn extracts_archives_with_a_root_directory_entry() {
        let root =
            std::env::temp_dir().join(format!("spicetify-archive-root-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("temporary archive root");
        let archive_path = root.join("xpui.spa");
        let output = root.join("xpui");

        let file = File::create(&archive_path).expect("create test archive");
        let mut archive = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default();
        archive.add_directory("/", options).expect("add Spotify 1.3 root entry");
        archive.add_directory("./", options).expect("add relative archive root entry");
        archive.start_file("./index.html", options).expect("add index");
        archive.write_all(b"<html></html>").expect("write index");
        let _file = archive.finish().expect("finish archive");

        unzip_file(&archive_path, &output).expect("root directory entry is harmless");
        assert_eq!(
            std::fs::read_to_string(output.join("index.html")).expect("index extracted"),
            "<html></html>"
        );

        std::fs::remove_dir_all(root).expect("cleanup test archive");
    }

    #[test]
    fn rejects_absolute_and_parent_paths() {
        for name in ["/payload.js", r"\payload.js", "../escape", "nested/../../escape"] {
            assert!(
                matches!(safe_relative_path(name), Err(ArchiveError::IllegalPath(path)) if path == name),
                "{name:?} must stay outside the extraction allowlist"
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn extraction_cannot_overwrite_a_file_through_an_existing_link() -> crate::error::Result<()> {
        let mut nonce = [0; 16];
        getrandom::fill(&mut nonce)?;
        let root =
            std::env::temp_dir().join(format!("spicetify-archive-link-{}", hex::encode(nonce)));
        std::fs::create_dir(&root)?;
        let outside = root.join("outside.txt");
        std::fs::write(&outside, "user data")?;
        let output = root.join("output");
        std::fs::create_dir(&output)?;
        std::os::unix::fs::symlink(&outside, output.join("index.js"))?;
        let source = root.join("artifact.zip");
        let mut archive = zip::ZipWriter::new(File::create(&source)?);
        archive.start_file("index.js", zip::write::SimpleFileOptions::default())?;
        archive.write_all(b"replacement")?;
        drop(archive.finish()?);

        let result = unzip_file(&source, &output);
        let retained = std::fs::read_to_string(&outside)?;
        std::fs::remove_dir_all(&root)?;
        assert_eq!(retained, "user data", "archive extraction escaped its destination");
        assert!(result.is_err(), "extraction must refuse an existing link");
        Ok(())
    }

    #[test]
    fn extraction_replaces_hard_links_without_overwriting_their_targets() -> crate::error::Result<()>
    {
        let mut nonce = [0; 16];
        getrandom::fill(&mut nonce)?;
        let root =
            std::env::temp_dir().join(format!("spicetify-archive-hardlink-{}", hex::encode(nonce)));
        std::fs::create_dir(&root)?;
        let outside = root.join("outside.txt");
        std::fs::write(&outside, "user data")?;
        let output = root.join("output");
        std::fs::create_dir(&output)?;
        std::fs::hard_link(&outside, output.join("index.js"))?;
        let source = root.join("artifact.zip");
        let mut archive = zip::ZipWriter::new(File::create(&source)?);
        archive.start_file("index.js", zip::write::SimpleFileOptions::default())?;
        archive.write_all(b"replacement")?;
        drop(archive.finish()?);

        unzip_file(&source, &output)?;
        let retained = std::fs::read_to_string(&outside)?;
        let installed = std::fs::read_to_string(output.join("index.js"))?;
        std::fs::remove_dir_all(&root)?;
        assert_eq!(retained, "user data", "archive extraction followed a hard link");
        assert_eq!(installed, "replacement");
        Ok(())
    }
}
