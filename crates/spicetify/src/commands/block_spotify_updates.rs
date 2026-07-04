// copied from amd64fox rollback spotify script
use std::fs;
use std::path::PathBuf;

use crate::context::AppContext;
use crate::error::Result;
use crate::{fl, util};

const FUNC_PROLOGUE_SCAN_LIMIT: usize = 20000;

struct PatchTargets {
    dll: PathBuf,
    exe: PathBuf,
    elf: PathBuf,
    dll_bak: PathBuf,
    exe_bak: PathBuf,
    elf_bak: PathBuf,
}

pub(crate) fn run(ctx: &AppContext, block: bool) -> Result<()> {
    let app_dir = ctx.spotify_exec_path.parent().ok_or_else(|| {
        crate::error::http_error(
            400,
            fl!("invalid-exec-path", path = ctx.spotify_exec_path.to_string_lossy()),
        )
    })?;

    let t = PatchTargets {
        dll: app_dir.join("Spotify.dll"),
        exe: app_dir.join("Spotify.exe"),
        elf: app_dir.join("chrome_elf.dll"),
        dll_bak: app_dir.join("Spotify.dll.backup"),
        exe_bak: app_dir.join("Spotify.exe.backup"),
        elf_bak: app_dir.join("chrome_elf.dll.backup"),
    };

    if !block {
        return unblock(&t);
    }

    if !t.dll.exists() || !t.exe.exists() || !t.elf.exists() {
        return Err(crate::error::http_error(422, fl!("missing-files-for-patch")));
    }

    let mut dll_data = fs::read(&t.dll)?;
    let mut exe_data = fs::read(&t.exe)?;
    let mut elf_data = fs::read(&t.elf)?;

    if is_already_blocked(&dll_data) {
        tracing::info!("{}", fl!("updates-already-blocked"));
        return Ok(());
    }

    strip_pe_signature(&mut dll_data)?;
    strip_pe_signature(&mut exe_data)?;
    strip_pe_signature(&mut elf_data)?;

    patch_sig_check(&mut dll_data)?;

    if !patch_update_url(&mut dll_data) {
        return Err(crate::error::http_error(422, fl!("update-url-not-found")));
    }

    fs::copy(&t.dll, &t.dll_bak).map(|_| ())?;
    fs::copy(&t.exe, &t.exe_bak).map(|_| ())?;
    fs::copy(&t.elf, &t.elf_bak).map(|_| ())?;

    fs::write(&t.dll, &dll_data)?;
    fs::write(&t.exe, &exe_data)?;
    fs::write(&t.elf, &elf_data)?;

    tracing::info!("{}", fl!("updates-blocked"));
    Ok(())
}

fn unblock(t: &PatchTargets) -> Result<()> {
    if !t.dll_bak.exists() || !t.exe_bak.exists() || !t.elf_bak.exists() {
        return Err(crate::error::http_error(422, fl!("backups-not-found")));
    }

    for p in [&t.dll, &t.exe, &t.elf] {
        if let Err(e) = fs::remove_file(p)
            && e.kind() != std::io::ErrorKind::NotFound
        {
            tracing::warn!(error = %e, path = %p.display(), "failed to remove file");
        }
    }
    fs::rename(&t.dll_bak, &t.dll)?;
    fs::rename(&t.exe_bak, &t.exe)?;
    fs::rename(&t.elf_bak, &t.elf)?;
    tracing::info!("{}", fl!("updates-unlocked"));
    Ok(())
}

#[derive(Debug)]
struct PeSection {
    va: u32,
    file_offset: u32,
    size: u32,
    is_code: bool,
}

fn read_le_u16(data: &[u8], offset: usize) -> Result<u16> {
    let bytes = data
        .get(offset..offset + 2)
        .ok_or_else(|| crate::error::http_error(422, fl!("not-valid-pe")))?;
    Ok(u16::from_le_bytes(bytes.try_into().expect("2-byte slice")))
}

fn read_le_u32(data: &[u8], offset: usize) -> Result<u32> {
    let bytes = data
        .get(offset..offset + 4)
        .ok_or_else(|| crate::error::http_error(422, fl!("not-valid-pe")))?;
    Ok(u32::from_le_bytes(bytes.try_into().expect("4-byte slice")))
}

fn read_le_i32(data: &[u8], offset: usize) -> Result<i32> {
    let bytes = data
        .get(offset..offset + 4)
        .ok_or_else(|| crate::error::http_error(422, fl!("not-valid-pe")))?;
    Ok(i32::from_le_bytes(bytes.try_into().expect("4-byte slice")))
}

fn parse_sections(data: &[u8], pe_offset: usize) -> Result<Vec<PeSection>> {
    let num = read_le_u16(data, pe_offset + 6)? as usize;
    let opt_size = read_le_u16(data, pe_offset + 20)? as usize;
    let table_start = pe_offset + 24 + opt_size;
    let mut sections = Vec::with_capacity(num);

    for i in 0..num {
        let s = table_start + i * 40;
        if s + 40 > data.len() {
            break;
        }
        let va = read_le_u32(data, s + 12)?;
        let size = read_le_u32(data, s + 16)?;
        let raw = read_le_u32(data, s + 20)?;
        let chars = read_le_u32(data, s + 36)?;
        sections.push(PeSection { va, file_offset: raw, size, is_code: (chars & 0x20) != 0 });
    }
    Ok(sections)
}

fn file_offset_to_rva(offset: u32, sections: &[PeSection]) -> u32 {
    sections
        .iter()
        .find(|s| offset >= s.file_offset && offset < s.file_offset + s.size)
        .map_or(0, |s| offset - s.file_offset + s.va)
}

fn strip_pe_signature(data: &mut [u8]) -> Result<()> {
    if data.len() < 0x40 {
        return Ok(());
    }
    let pe_offset = read_le_u32(data, 0x3C)? as usize;
    if pe_offset + 24 > data.len() || data.get(pe_offset..pe_offset + 2) != Some(b"PE") {
        return Err(crate::error::http_error(422, fl!("not-valid-pe")));
    }
    let machine = read_le_u16(data, pe_offset + 4)?;
    let opt_offset = pe_offset + 24;
    let data_dir_offset = match machine {
        0x8664 | 0xAA64 => opt_offset + 112,
        0x014C => opt_offset + 96,
        _ => anyhow::bail!("unsupported PE architecture ({machine:#06X})"),
    };
    let cert_offset = data_dir_offset + 32;
    if cert_offset + 8 > data.len() {
        return Err(crate::error::http_error(400, fl!("data-dir-oob")));
    }
    if let Some(entry) = data.get_mut(cert_offset..cert_offset + 8) {
        entry.fill(0);
    }
    Ok(())
}

fn patch_sig_check(data: &mut [u8]) -> Result<()> {
    let needle = b"Check failed: sep_pos != std::wstring::npos.";
    let str_offset = u32::try_from(
        util::find_subslice(data, needle)
            .ok_or_else(|| crate::error::http_error(422, fl!("sig-check-str-not-found")))?,
    )
    .map_err(|_| crate::error::http_error(422, fl!("not-valid-pe")))?;

    let pe_offset = read_le_u32(data, 0x3C)? as usize;
    let machine = read_le_u16(data, pe_offset + 4)?;
    let is_arm = machine == 0xAA64;

    let sections = parse_sections(data, pe_offset)?;
    let str_rva = file_offset_to_rva(str_offset, &sections);
    if str_rva == 0 {
        return Err(crate::error::http_error(422, fl!("rva-calc-failed")));
    }

    let code_sec = sections
        .iter()
        .find(|s| s.is_code)
        .ok_or_else(|| crate::error::http_error(422, fl!("no-exec-section")))?;
    let start = code_sec.file_offset as usize;
    let end = (code_sec.file_offset + code_sec.size) as usize;
    let patch_offset = if is_arm {
        find_call_site_arm64(data, start, end, str_rva, &sections)?
    } else {
        find_call_site_x64(data, start, end, str_rva, &sections)?
    };

    if patch_offset == 0 {
        return Err(crate::error::http_error(422, fl!("call-site-not-found")));
    }

    let patch: &[u8] = if is_arm {
        &[0x20, 0x00, 0x80, 0x52, 0xC0, 0x03, 0x5F, 0xD6]
    } else {
        &[0xB8, 0x01, 0x00, 0x00, 0x00, 0xC3]
    };
    let dst_end = patch_offset
        .checked_add(patch.len())
        .filter(|&e| e <= data.len())
        .ok_or_else(|| crate::error::http_error(422, fl!("not-valid-pe")))?;
    if let Some(dst) = data.get_mut(patch_offset..dst_end) {
        dst.copy_from_slice(patch);
    }
    Ok(())
}

fn is_already_blocked(data: &[u8]) -> bool {
    util::find_subslice(data, b"desktop-update/7/update").is_some()
}

fn patch_update_url(data: &mut [u8]) -> bool {
    let prefix = b"desktop-update/";
    let mut found = false;
    let mut idx = 0;

    while let Some(pos) = util::find_subslice(data.get(idx..).unwrap_or(&[]), prefix) {
        let abs = idx + pos;

        let ver_pos = abs + prefix.len();
        let Some(&version_char) = data.get(ver_pos) else {
            idx = abs + 1;
            continue;
        };
        if version_char != b'2' {
            idx = abs + 1;
            continue;
        }

        let suf_pos = ver_pos + 1;
        if data.get(suf_pos..suf_pos + 2) == Some(b"/u")
            && let Some(v) = data.get_mut(ver_pos)
        {
            *v = b'7';
            found = true;
        }
        idx = abs + 1;
    }
    found
}

fn find_call_site_x64(
    data: &[u8],
    start: usize,
    end: usize,
    str_rva: u32,
    sections: &[PeSection],
) -> Result<usize> {
    let limit = end.saturating_sub(7);
    let mut i = start;
    while i < limit {
        if data.get(i..i + 3) == Some(&[0x48, 0x8D, 0x15]) {
            let rel = read_le_i32(data, i + 3)?;
            let i_u32 =
                u32::try_from(i).map_err(|_| crate::error::http_error(422, fl!("not-valid-pe")))?;
            let rva = file_offset_to_rva(i_u32, sections);
            let target = (rva.cast_signed() + 7 + rel).cast_unsigned();
            if target == str_rva {
                return Ok(find_func_start_x64(data, i));
            }
        }
        i += 1;
    }
    Ok(0)
}

fn find_func_start_x64(data: &[u8], call_site: usize) -> usize {
    for i in (2..=call_site).rev() {
        let p1 = data.get(i - 1).copied().unwrap_or(0);
        let p2 = data.get(i - 2).copied().unwrap_or(0);
        if (p1 == 0xCC && p2 == 0xCC) || (p1 == 0x90 && p2 == 0x90) {
            let b = data.get(i).copied().unwrap_or(0);
            if b != 0xCC
                && b != 0x90
                && (b == 0x48 || b == 0x40 || b == 0x55 || (0x53..=0x57).contains(&b))
            {
                return i;
            }
        }
        if call_site - i > FUNC_PROLOGUE_SCAN_LIMIT {
            break;
        }
    }
    0
}

fn find_call_site_arm64(
    data: &[u8],
    start: usize,
    end: usize,
    str_rva: u32,
    sections: &[PeSection],
) -> Result<usize> {
    let mut i = start;
    while i + 8 <= end {
        let inst1 = read_le_u32(data, i)?;
        if (inst1 & 0x9F00_0000) == 0x9000_0000 {
            let rd = inst1 & 0x1F;
            let imm_lo = (inst1 >> 29) & 3;
            let imm_hi = (inst1 >> 5) & 0x7_FFFF;
            let mut imm = (imm_hi << 2) | imm_lo;
            if (imm & 0x0010_0000) != 0 {
                imm |= 0xFFE0_0000;
            }
            let imm = i64::from(imm.cast_signed()) << 12;
            let i_u32 =
                u32::try_from(i).map_err(|_| crate::error::http_error(422, fl!("not-valid-pe")))?;
            let pc = u64::from(file_offset_to_rva(i_u32, sections));
            let page = (pc & 0x000F_FFFF_FFFF_F000).cast_signed() + imm;
            #[allow(clippy::cast_sign_loss)]
            let page = page.cast_unsigned();

            let inst2 = read_le_u32(data, i + 4)?;
            if (inst2 & 0xFF80_0000) == 0x9100_0000 {
                let rn = (inst2 >> 5) & 0x1F;
                if rn == rd {
                    let imm12 = (inst2 >> 10) & 0xFFF;
                    if page + u64::from(imm12) == u64::from(str_rva) {
                        return Ok(find_func_start_arm64(data, i));
                    }
                }
            }
        }
        i += 4;
    }
    Ok(0)
}

fn find_func_start_arm64(data: &[u8], call_site: usize) -> usize {
    let aligned = call_site - (call_site % 4);
    let mut i = aligned;
    while i >= 4 {
        let Some(window) = data.get(i..i + 4) else { break };
        let bytes: [u8; 4] = match window.try_into() {
            Ok(b) => b,
            Err(_) => break,
        };
        let inst = u32::from_le_bytes(bytes);
        if (inst & 0xFF00_FFFF) == 0xA900_7BFD {
            return i;
        }
        if call_site - i > FUNC_PROLOGUE_SCAN_LIMIT {
            break;
        }
        i = i.saturating_sub(4);
    }
    0
}
