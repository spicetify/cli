//! A socket owns the native filter. Dropping it restores hit-testing.
#![allow(unsafe_code)]

use std::ffi::c_void;
use std::io::Write;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket};
use sha2::{Digest, Sha256};
use tokio_stream::StreamExt;
use windows::Win32::Foundation::{FreeLibrary, HMODULE};
use windows::Win32::System::LibraryLoader::{
    GetProcAddress, LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR, LOAD_LIBRARY_SEARCH_SYSTEM32, LoadLibraryExW,
};
use windows::core::{PCWSTR, s};

use crate::server::DaemonState;

static OWNER: std::sync::Mutex<()> = std::sync::Mutex::new(());
const DLL: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/window_controls.dll"));
type Begin = unsafe extern "C" fn(*const u16) -> *mut c_void;
type End = unsafe extern "C" fn(*mut c_void) -> bool;
type Active = unsafe extern "C" fn(*mut c_void) -> bool;

struct Session {
    native: *mut c_void,
    end: End,
    active: Active,
    _library: Library,
}

struct Library(HMODULE);
impl Drop for Library {
    fn drop(&mut self) {
        // The target process pins its own module before installing callbacks.
        let _ = unsafe { FreeLibrary(self.0) };
    }
}

impl Session {
    fn is_active(&self) -> bool {
        // The query only acknowledges the original window and its live filter.
        unsafe { (self.active)(self.native) }
    }

    fn release(mut self) -> bool {
        let native = std::mem::replace(&mut self.native, std::ptr::null_mut());
        // This consumes the native session; a failed acknowledgement also
        // signals its stop event so the target can detach on its next timer.
        unsafe { (self.end)(native) }
    }

    fn begin(root: &Path, exe: &Path) -> anyhow::Result<Self> {
        let directory = root.join("native");
        std::fs::create_dir_all(&directory)?;
        let path =
            directory.join(format!("window-controls-{}.dll", hex::encode(Sha256::digest(DLL))));
        match std::fs::OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut file) => file.write_all(DLL)?,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(error) => return Err(error.into()),
        }
        anyhow::ensure!(
            std::fs::read(&path)? == DLL,
            "native window helper differs from the embedded build"
        );
        let library_path: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        let executable: Vec<u16> = exe.as_os_str().encode_wide().chain(Some(0)).collect();
        // Both exports are from our byte-verified, embedded DLL. The library
        // handle outlives the session and all calls through these pointers.
        unsafe {
            let library = Library(LoadLibraryExW(
                PCWSTR(library_path.as_ptr()),
                None,
                LOAD_LIBRARY_SEARCH_DLL_LOAD_DIR | LOAD_LIBRARY_SEARCH_SYSTEM32,
            )?);
            let begin: Begin = std::mem::transmute(
                GetProcAddress(library.0, s!("begin_window_controls"))
                    .ok_or_else(|| anyhow::anyhow!("native helper has no begin export"))?,
            );
            let end: End = std::mem::transmute(
                GetProcAddress(library.0, s!("end_window_controls"))
                    .ok_or_else(|| anyhow::anyhow!("native helper has no end export"))?,
            );
            let active: Active = std::mem::transmute(
                GetProcAddress(library.0, s!("window_controls_active"))
                    .ok_or_else(|| anyhow::anyhow!("native helper has no active export"))?,
            );
            let native = begin(executable.as_ptr());
            anyhow::ensure!(
                !native.is_null(),
                "could not install Spotify's native window-control filter"
            );
            Ok(Self { native, end, active, _library: library })
        }
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        // The native owner deletes its state even if Spotify has exited.
        if !self.native.is_null() && !unsafe { (self.end)(self.native) } {
            tracing::warn!("Spotify did not acknowledge removal of the window-control filter");
        }
    }
}

pub(crate) async fn serve(mut socket: WebSocket, state: Arc<DaemonState>) {
    let ctx = state.ctx.load();
    let root = ctx.config_root.clone();
    let exe = ctx.spotify_exec.clone();
    let (ready_tx, ready_rx) = tokio::sync::oneshot::channel();
    let (done_tx, mut done_rx) = tokio::sync::oneshot::channel();
    let (stop_tx, stop_rx) = std::sync::mpsc::channel();
    // Native messages can wait on an unresponsive Spotify. Keep them off the
    // daemon's single-thread runtime; dropping the socket's sender stops this
    // worker even when its async task is cancelled.
    let worker = std::thread::Builder::new().name("window-controls".into()).spawn(move || {
        let Ok(owner) = OWNER.try_lock() else {
            let _ = ready_tx.send(Err(anyhow::anyhow!("window controls already owned")));
            return;
        };
        let session = match Session::begin(&root, &exe) {
            Ok(session) => session,
            Err(error) => {
                let _ = ready_tx.send(Err(error));
                return;
            }
        };
        if ready_tx.send(Ok(())).is_err() {
            return;
        }
        while let Err(std::sync::mpsc::RecvTimeoutError::Timeout) =
            stop_rx.recv_timeout(std::time::Duration::from_secs(1))
        {
            if !session.is_active() {
                break;
            }
        }
        let released = session.release();
        drop(owner);
        let _ = done_tx.send(released);
    });
    if let Err(error) = worker {
        let _ = socket.send(Message::Text(format!("error:{error}").into())).await;
        return;
    }
    match ready_rx.await {
        Ok(Ok(())) => {}
        result => {
            let error = match result {
                Ok(Err(error)) => error.to_string(),
                _ => "native worker stopped".into(),
            };
            tracing::warn!(%error, "native window controls unavailable");
            let _ = socket.send(Message::Text(format!("error:{error}").into())).await;
            return;
        }
    }
    if socket.send(Message::Text("ready".into())).await.is_err() {
        return;
    }
    let completed = loop {
        tokio::select! {
            result = &mut done_rx => break Some(result.unwrap_or(false)),
            () = state.shutdown.notified() => break None,
            message = socket.next() => match message {
                Some(Ok(Message::Text(text))) if text == "release" => break None,
                Some(Ok(Message::Ping(_) | Message::Pong(_))) => {},
                _ => break None,
            }
        }
    };
    let _ = stop_tx.send(());
    let released = match completed {
        Some(released) => released,
        None => done_rx.await.unwrap_or(false),
    };
    let reply =
        if released { "released" } else { "error:native filter removal was not acknowledged" };
    let _ = socket.send(Message::Text(reply.into())).await;
    let _ = socket.send(Message::Close(None)).await;
}

#[cfg(all(test, feature = "native-window-controls-tests"))]
mod tests {
    #[test]
    fn native_filter_lifecycle_across_processes() {
        let out = std::path::Path::new(env!("OUT_DIR"));
        let output = std::process::Command::new(out.join("window_controls_test.exe"))
            .arg(out.join("window_controls.dll"))
            .output()
            .expect("run native window tests");
        assert!(
            output.status.success(),
            "{}{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }
}
