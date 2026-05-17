#[cfg(windows)]
mod windows_impl {
    use std::{
        ffi::OsStr, fs, io, os::windows::ffi::OsStrExt, path::{Path, PathBuf}, thread, time::Duration
    };

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

    const RETRY_COUNT: u32 = 200;
    const RETRY_DELAY_MS: u64 = 100;

    fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
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

    fn kill_spicetify_processes() {
        let _ = std::process::Command::new("schtasks")
            .args(["/End", "/TN", "Spicetify daemon"])
            .output();

        let output = std::process::Command::new("taskkill")
            .args(["/IM", "spicetify.exe", "/F"])
            .output();
        if let Ok(out) = &output
            && !out.status.success()
        {
            eprintln!(
                "taskkill warning: {}",
                String::from_utf8_lossy(&out.stderr).trim()
            );
        }
    }

    fn launch_exe(exe: &Path) {
        let wide = to_wide(&exe.to_string_lossy());
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

    struct Job {
        src: PathBuf,
        dst: PathBuf,
    }

    impl Job {
        fn apply(&self) -> io::Result<()> {
            if !self.src.exists() {
                return Ok(());
            }
            let old = self.dst.with_extension("exe.old");
            if self.dst.exists() {
                let _ = fs::remove_file(&old);
                retry_io(|| fs::rename(&self.dst, &old))?;
            }
            retry_io(|| fs::copy(&self.src, &self.dst))?;
            let _ = fs::remove_file(&old);
            Ok(())
        }

        fn rollback(&self) {
            let old = self.dst.with_extension("exe.old");
            if old.exists() {
                let _ = fs::remove_file(&self.dst);
                let _ = fs::rename(&old, &self.dst);
            }
        }
    }

    fn retry_io<F, T>(mut f: F) -> io::Result<T>
    where
        F: FnMut() -> io::Result<T>,
    {
        for _ in 0..RETRY_COUNT {
            match f() {
                Ok(v) => return Ok(v),
                Err(e)
                    if e.kind() == io::ErrorKind::PermissionDenied
                        || e.raw_os_error() == Some(32)
                        || e.raw_os_error() == Some(5) =>
                {
                    thread::sleep(Duration::from_millis(RETRY_DELAY_MS));
                }
                Err(e) => return Err(e),
            }
        }
        f()
    }

    fn collect_jobs(app_dir: &Path, update_dir: &Path) -> Vec<Job> {
        vec![
            Job {
                src: update_dir.join("bin").join("spicetify.exe"),
                dst: app_dir.join("bin").join("spicetify.exe"),
            },
            Job {
                src: update_dir.join("tools").join("auto_update_helper.exe"),
                dst: app_dir.join("tools").join("auto_update_helper.exe"),
            },
        ]
    }

    fn perform_update(jobs: &[Job]) -> Result<(), Vec<usize>> {
        let mut applied: Vec<usize> = Vec::with_capacity(jobs.len());
        for (i, job) in jobs.iter().enumerate() {
            if let Err(e) = job.apply() {
                eprintln!(
                    "job[{}] failed: {} (src={:?}, dst={:?})",
                    i, e, job.src, job.dst
                );
                for &idx in applied.iter().rev() {
                    jobs[idx].rollback();
                }
                return Err(applied);
            }
            applied.push(i);
        }
        Ok(())
    }

    pub fn run() {
        let args: Vec<String> = std::env::args().collect();
        if args.len() != 4 {
            eprintln!("Usage: auto_update_helper.exe <parent_pid> <app_dir> <update_dir>");
            std::process::exit(1);
        }

        let parent_pid: u32 = args[1].parse().unwrap_or(0);
        let app_dir = PathBuf::from(&args[2]);
        let update_dir = PathBuf::from(&args[3]);

        if parent_pid != 0 {
            wait_for_process(parent_pid);
        }

        thread::sleep(Duration::from_millis(500));

        kill_spicetify_processes();
        thread::sleep(Duration::from_millis(500));

        let jobs = collect_jobs(&app_dir, &update_dir);
        if let Err(applied) = perform_update(&jobs) {
            eprintln!("update failed after {} jobs; rolled back", applied.len());
            std::process::exit(1);
        }

        for _ in 0..10 {
            match fs::remove_dir_all(&update_dir) {
                Ok(()) => break,
                Err(e) => {
                    eprintln!("cleanup failed, retrying: {e}");
                    thread::sleep(Duration::from_millis(100));
                }
            }
        }

        let exe = app_dir.join("bin").join("spicetify.exe");
        if exe.exists() {
            launch_exe(&exe);
        }
    }
}

#[cfg(not(windows))]
fn main() {
    eprintln!("auto_update_helper is currently Windows-only");
    std::process::exit(1);
}

#[cfg(windows)]
fn main() {
    windows_impl::run();
}
