use std::{fs, path::Path};

use anyhow::{Context, Result, anyhow, bail};

use crate::{config::AppContext, i18n, logging, util};

pub fn run(ctx: &AppContext, block: bool) -> Result<()> {
    let app_dir = ctx
        .spotify_exec_path
        .parent()
        .context(i18n::lookup("invalid_exec_path"))?;

    let dll = app_dir.join("Spotify.dll");
    let exe = app_dir.join("Spotify.exe");
    let elf = app_dir.join("chrome_elf.dll");

    let dll_bak = app_dir.join("Spotify.dll.backup");
    let exe_bak = app_dir.join("Spotify.exe.backup");
    let elf_bak = app_dir.join("chrome_elf.dll.backup");
    let backups_exist = dll_bak.exists() && exe_bak.exists() && elf_bak.exists();

    if !block {
        return unblock(
            &dll,
            &exe,
            &elf,
            &dll_bak,
            &exe_bak,
            &elf_bak,
            backups_exist,
        );
    }

    if backups_exist {
        logging::info(i18n::lookup("updates_already_blocked"));
        return Ok(());
    }

    if !dll.exists() || !exe.exists() || !elf.exists() {
        bail!(i18n::lookup("missing_files_for_patch"));
    }

    let mut dll_data = fs::read(&dll).context(i18n::lookup("failed_read_dll"))?;
    let mut exe_data = fs::read(&exe).context(i18n::lookup("failed_read_exe"))?;
    let mut elf_data = fs::read(&elf).context(i18n::lookup("failed_read_elf"))?;

    strip_pe_signature(&mut dll_data).context(i18n::lookup("failed_strip_dll"))?;
    strip_pe_signature(&mut exe_data).context(i18n::lookup("failed_strip_exe"))?;
    strip_pe_signature(&mut elf_data).context(i18n::lookup("failed_strip_elf"))?;

    patch_sig_check(&mut dll_data).context(i18n::lookup("failed_patch_sig_check"))?;

    if !patch_update_url(&mut dll_data) {
        bail!(i18n::lookup("update_url_not_found"));
    }

    fs::copy(&dll, &dll_bak).context(i18n::lookup("failed_backup_dll"))?;
    fs::copy(&exe, &exe_bak).context(i18n::lookup("failed_backup_exe"))?;
    fs::copy(&elf, &elf_bak).context(i18n::lookup("failed_backup_elf"))?;

    fs::write(&dll, &dll_data)?;
    fs::write(&exe, &exe_data)?;
    fs::write(&elf, &elf_data)?;

    logging::info(i18n::lookup("updates_blocked"));
    Ok(())
}

fn unblock(
    dll: &Path,
    exe: &Path,
    elf: &Path,
    dll_bak: &Path,
    exe_bak: &Path,
    elf_bak: &Path,
    backups_exist: bool,
) -> Result<()> {
    if backups_exist {
        let _ = fs::remove_file(dll);
        let _ = fs::remove_file(exe);
        let _ = fs::remove_file(elf);
        fs::rename(dll_bak, dll)?;
        fs::rename(exe_bak, exe)?;
        fs::rename(elf_bak, elf)?;
        logging::info(i18n::lookup("updates_unlocked"));
    } else {
        logging::info(i18n::lookup("backups_not_found"));
    }
    Ok(())
}

struct PeSection {
    va: u32,
    file_offset: u32,
    size: u32,
    is_code: bool,
}

fn parse_sections(data: &[u8], pe_offset: usize) -> Result<Vec<PeSection>> {
    let num = u16::from_le_bytes(data[pe_offset + 6..pe_offset + 8].try_into()?) as usize;
    let opt_size = u16::from_le_bytes(data[pe_offset + 20..pe_offset + 22].try_into()?) as usize;
    let table_start = pe_offset + 24 + opt_size;
    let mut sections = Vec::with_capacity(num);

    for i in 0..num {
        let s = table_start + i * 40;
        if s + 40 > data.len() {
            break;
        }
        let va = u32::from_le_bytes(data[s + 12..s + 16].try_into()?);
        let size = u32::from_le_bytes(data[s + 16..s + 20].try_into()?);
        let raw = u32::from_le_bytes(data[s + 20..s + 24].try_into()?);
        let chars = u32::from_le_bytes(data[s + 36..s + 40].try_into()?);
        sections.push(PeSection {
            va,
            file_offset: raw,
            size,
            is_code: (chars & 0x20) != 0,
        });
    }
    Ok(sections)
}

fn file_offset_to_rva(offset: u32, sections: &[PeSection]) -> u32 {
    for s in sections {
        if offset >= s.file_offset && offset < s.file_offset + s.size {
            return offset - s.file_offset + s.va;
        }
    }
    0
}

fn strip_pe_signature(data: &mut [u8]) -> Result<()> {
    if data.len() < 0x40 {
        return Ok(());
    }
    let pe_offset = u32::from_le_bytes(data[0x3C..0x40].try_into()?) as usize;
    if pe_offset + 24 > data.len() || &data[pe_offset..pe_offset + 2] != b"PE" {
        bail!(i18n::lookup("not_valid_pe"));
    }

    let machine = u16::from_le_bytes(data[pe_offset + 4..pe_offset + 6].try_into()?);
    let opt_offset = pe_offset + 24;
    let data_dir_offset = match machine {
        0x8664 | 0xAA64 => opt_offset + 112,
        0x014C => opt_offset + 96,
        _ => bail!(i18n::lookup("unsupported_arch")),
    };
    let cert_offset = data_dir_offset + 32;
    if cert_offset + 8 > data.len() {
        bail!(i18n::lookup("data_dir_oob"));
    }
    data[cert_offset..cert_offset + 8].fill(0);
    Ok(())
}

fn patch_sig_check(data: &mut [u8]) -> Result<()> {
    let needle = b"Check failed: sep_pos != std::wstring::npos.";
    let str_offset = util::find_bytes(data, needle)
        .ok_or_else(|| anyhow!(i18n::lookup("sig_check_str_not_found")))?
        as u32;

    let pe_offset = u32::from_le_bytes(data[0x3C..0x40].try_into()?) as usize;
    let machine = u16::from_le_bytes(data[pe_offset + 4..pe_offset + 6].try_into()?);
    let is_arm = machine == 0xAA64;

    let sections = parse_sections(data, pe_offset)?;
    let str_rva = file_offset_to_rva(str_offset, &sections);
    if str_rva == 0 {
        bail!(i18n::lookup("rva_calc_failed"));
    }

    let code_sec = sections
        .iter()
        .find(|s| s.is_code)
        .context(i18n::lookup("no_exec_section"))?;

    let start = code_sec.file_offset as usize;
    let end = (code_sec.file_offset + code_sec.size) as usize;
    let patch_offset = if is_arm {
        find_call_site_arm64(data, start, end, str_rva, &sections)
    } else {
        find_call_site_x64(data, start, end, str_rva, &sections)
    };

    if patch_offset == 0 {
        bail!(i18n::lookup("call_site_not_found"));
    }

    let patch: &[u8] = if is_arm {
        &[0x20, 0x00, 0x80, 0x52, 0xC0, 0x03, 0x5F, 0xD6]
    } else {
        &[0xB8, 0x01, 0x00, 0x00, 0x00, 0xC3]
    };
    data[patch_offset..patch_offset + patch.len()].copy_from_slice(patch);
    Ok(())
}

fn patch_update_url(data: &mut [u8]) -> bool {
    let prefix = b"desktop-update/";
    let suffix = b"/update";
    let mut found = false;
    let mut idx = 0;

    while let Some(pos) = util::find_bytes(&data[idx..], prefix) {
        let abs = idx + pos;
        let ver_pos = abs + prefix.len() + 1;
        let suf_pos = ver_pos + 1;
        if suf_pos + suffix.len() <= data.len()
            && data[ver_pos] == b'2'
            && &data[suf_pos..suf_pos + suffix.len()] == suffix
        {
            data[ver_pos] = b'7';
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
) -> usize {
    for i in start..end.saturating_sub(7) {
        if data[i] == 0x48 && data[i + 1] == 0x8D && data[i + 2] == 0x15 {
            let rel = i32::from_le_bytes(data[i + 3..i + 7].try_into().unwrap());
            let target = (file_offset_to_rva(i as u32, sections) as i32 + 7 + rel) as u32;
            if target == str_rva {
                return find_func_start_x64(data, i);
            }
        }
    }
    0
}

fn find_func_start_x64(data: &[u8], call_site: usize) -> usize {
    for i in (0..call_site).rev() {
        if i < 2 {
            break;
        }
        let (p1, p2) = (data[i - 1], data[i - 2]);
        if (p1 == 0xCC && p2 == 0xCC) || (p1 == 0x90 && p2 == 0x90) {
            let b = data[i];
            if b != 0xCC
                && b != 0x90
                && (b == 0x48 || b == 0x40 || b == 0x55 || (0x53..=0x57).contains(&b))
            {
                return i;
            }
        }
        if call_site - i > 20000 {
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
) -> usize {
    let mut i = start;
    while i + 8 <= end {
        let inst1 = u32::from_le_bytes(data[i..i + 4].try_into().unwrap());
        if (inst1 & 0x9F000000) == 0x90000000 {
            let rd = inst1 & 0x1F;
            let imm_lo = (inst1 >> 29) & 3;
            let imm_hi = (inst1 >> 5) & 0x7FFFF;
            let mut imm = (imm_hi << 2) | imm_lo;
            if (imm & 0x100000) != 0 {
                imm |= 0xFFE00000;
            }
            let imm = (imm as i32 as i64) << 12;
            let pc = file_offset_to_rva(i as u32, sections) as u64;
            let page = ((pc & 0xFFFF_FFFF_FFFF_F000) as i64 + imm) as u64;

            let inst2 = u32::from_le_bytes(data[i + 4..i + 8].try_into().unwrap());
            if (inst2 & 0xFF800000) == 0x91000000 {
                let rn = (inst2 >> 5) & 0x1F;
                if rn == rd {
                    let imm12 = (inst2 >> 10) & 0xFFF;
                    if page + imm12 as u64 == str_rva as u64 {
                        return find_func_start_arm64(data, i);
                    }
                }
            }
        }
        i += 4;
    }
    0
}

fn find_func_start_arm64(data: &[u8], call_site: usize) -> usize {
    let aligned = call_site - (call_site % 4);
    for i in (0..aligned).rev().step_by(4) {
        if i + 4 > data.len() {
            continue;
        }
        let inst = u32::from_le_bytes(data[i..i + 4].try_into().unwrap());
        if (inst & 0xFF00FFFF) == 0xA9007BFD {
            return i;
        }
        if call_site - i > 20000 {
            break;
        }
    }
    0
}
