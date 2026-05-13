#[cfg(windows)]
mod windows_impl {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    unsafe extern "system" {
        fn OpenProcess(desired_access: u32, inherit_handle: i32, process_id: u32) -> isize;
        fn WaitForSingleObject(handle: isize, milliseconds: u32) -> u32;
        fn CloseHandle(handle: isize) -> i32;
        fn CreateProcessW(
            lpApplicationName: *const u16,
            lpCommandLine: *mut u16,
            lpProcessAttributes: isize,
            lpThreadAttributes: isize,
            bInheritHandles: i32,
            dwCreationFlags: u32,
            lpEnvironment: isize,
            lpCurrentDirectory: *const u16,
            lpStartupInfo: *mut u16,
            lpProcessInformation: *mut isize,
        ) -> i32;
    }

    const PROCESS_SYNCHRONIZE: u32 = 0x00100000;
    const INFINITE: u32 = 0xFFFFFFFF;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s).encode_wide().chain(std::iter::once(0)).collect()
    }

    fn wait_for_process(pid: u32) {
        let handle = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, 0, pid) };
        if handle != 0 {
            unsafe {
                WaitForSingleObject(handle, INFINITE);
                CloseHandle(handle);
            }
        }
    }

    fn run_installer(installer: &str) -> bool {
        let wide = to_wide(installer);
        let mut args = to_wide(&format!(
            "\"{installer}\" /VERYSILENT /update=true /NORESTART",
        ));
        let mut startup_info: [u16; 68] = [0; 68];
        startup_info[0] = 68u16;
        let mut proc_info: [isize; 4] = [0; 4];

        let result = unsafe {
            CreateProcessW(
                wide.as_ptr(),
                args.as_mut_ptr(),
                0,
                0,
                0,
                CREATE_NO_WINDOW,
                0,
                std::ptr::null_mut(),
                startup_info.as_mut_ptr(),
                proc_info.as_mut_ptr(),
            )
        };

        if result == 0 {
            return false;
        }

        let p_handle = proc_info[0];
        if p_handle != 0 {
            unsafe {
                WaitForSingleObject(p_handle, INFINITE);
                CloseHandle(p_handle);
            }
        }
        if proc_info[1] != 0 {
            unsafe { CloseHandle(proc_info[1]) };
        }
        true
    }

    fn launch_exe(exe: &str) {
        let wide = to_wide(exe);
        let mut startup_info: [u16; 68] = [0; 68];
        startup_info[0] = 68u16;
        let mut proc_info: [isize; 4] = [0; 4];
        unsafe {
            CreateProcessW(
                wide.as_ptr(),
                std::ptr::null_mut(),
                0,
                0,
                0,
                CREATE_NO_WINDOW,
                0,
                std::ptr::null_mut(),
                startup_info.as_mut_ptr(),
                proc_info.as_mut_ptr(),
            );
        }
    }

    pub fn run() {
        let args: Vec<String> = std::env::args().collect();
        if args.len() != 4 {
            eprintln!("Usage: auto_update_helper.exe <parent_pid> <installer_path> <app_dir>");
            std::process::exit(1);
        }

        let parent_pid: u32 = args[1].parse().unwrap_or(0);
        let installer_path = &args[2];
        let app_dir = &args[3];

        if parent_pid != 0 {
            wait_for_process(parent_pid);
        }

        std::thread::sleep(std::time::Duration::from_millis(300));

        run_installer(installer_path);

        let install_bin = std::path::Path::new(app_dir).join("install").join("bin");
        let app_bin = std::path::Path::new(app_dir).join("bin");

        if install_bin.exists() {
            if let Ok(entries) = std::fs::read_dir(&install_bin) {
                for entry in entries.flatten() {
                    let dest = app_bin.join(entry.file_name());
                    let _ = std::fs::rename(entry.path(), &dest);
                }
            }
            let _ = std::fs::remove_dir_all(install_bin.parent().unwrap_or(&install_bin));
        }

        let exe = app_bin.join("spicetify.exe");
        launch_exe(&exe.to_string_lossy());

        let _ = std::fs::remove_file(installer_path);
    }
}

#[cfg(not(windows))]
fn main() {
    // TODO: Implement auto_update_helper for macOS and Linux
    eprintln!("auto_update_helper is currently Windows-only");
    std::process::exit(1);
}

#[cfg(windows)]
fn main() {
    windows_impl::run();
}
