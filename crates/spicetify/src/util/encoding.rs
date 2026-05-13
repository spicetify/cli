use anyhow::{Context, Result, bail};

use crate::i18n;

pub fn encode_utf16le(input: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(input.len() * 2);
    for unit in input.encode_utf16() {
        out.extend_from_slice(&unit.to_le_bytes());
    }
    out
}

pub fn decode_utf16le(input: &[u8]) -> Result<String> {
    if !input.len().is_multiple_of(2) {
        bail!(i18n::lookup("invalid_utf16le"))
    }
    let units: Vec<u16> = input
        .chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .collect();
    String::from_utf16(&units).context(i18n::lookup("invalid_utf16_seq"))
}

pub fn extract_utf16le_between(snapshot: &[u8], start: &str, end: &str) -> Result<String> {
    let start_b = encode_utf16le(start);
    let end_b = encode_utf16le(end);

    let start_pos = find_bytes(snapshot, &start_b)
        .ok_or_else(|| anyhow::anyhow!(i18n::lookup("start_marker_not_found")))?;
    let end_pos_rel = find_bytes(&snapshot[start_pos..], &end_b)
        .ok_or_else(|| anyhow::anyhow!(i18n::lookup("end_marker_not_found")))?;

    let end_pos = start_pos + end_pos_rel + end_b.len();
    decode_utf16le(&snapshot[start_pos..end_pos])
}

pub fn find_bytes(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }
    haystack.windows(needle.len()).position(|w| w == needle)
}

pub fn rfind_bytes(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }
    haystack.windows(needle.len()).rposition(|w| w == needle)
}
