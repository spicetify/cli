use thiserror::Error;

pub(crate) mod archive;
pub(crate) mod link;

pub(crate) use archive::{untar_zst_bytes, unzip_file};
pub(crate) use link::create_dir_link;

#[derive(Debug, Error)]
pub(crate) enum ArchiveError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("zip error: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("illegal path in archive: {0}")]
    IllegalPath(String),
}

#[must_use]
pub(crate) fn find_subslice(data: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || needle.len() > data.len() {
        return None;
    }
    data.windows(needle.len()).position(|window| window == needle)
}

#[must_use]
pub(crate) fn rfind_subslice(data: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || needle.len() > data.len() {
        return None;
    }
    data.windows(needle.len()).rposition(|window| window == needle)
}

#[must_use]
#[allow(clippy::indexing_slicing, reason = "offsets come from find_subslice bounds checks")]
pub(crate) fn extract_utf16le_between(data: &[u8], start: &str, end: &str) -> Option<String> {
    let start_b = utf16le_bytes(start);
    let end_b = utf16le_bytes(end);

    let start_pos = find_subslice(data, &start_b)?;
    let end_pos_rel = find_subslice(&data[start_pos..], &end_b)?;
    let end_pos = start_pos + end_pos_rel + end_b.len();

    decode_utf16le(&data[start_pos..end_pos])
}

fn utf16le_bytes(s: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(s.len() * 2);
    for unit in s.encode_utf16() {
        out.extend_from_slice(&unit.to_le_bytes());
    }
    out
}

// spotify embeds utf-16le strings in some of their binaries. why.
fn decode_utf16le(input: &[u8]) -> Option<String> {
    if !input.len().is_multiple_of(2) {
        return None;
    }
    let units: Vec<u16> =
        input.as_chunks::<2>().0.iter().map(|[a, b]| u16::from_le_bytes([*a, *b])).collect();
    String::from_utf16(&units).ok()
}
