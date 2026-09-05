#[cfg(windows)]
fn main() {
    use std::path::PathBuf;
    println!("cargo:rerun-if-changed=native/window_controls.cpp");
    let out = PathBuf::from(std::env::var_os("OUT_DIR").expect("OUT_DIR"));
    let source = PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").expect("manifest"))
        .join("native/window_controls.cpp");
    let compiler = cc::Build::new().cpp(true).get_compiler();
    assert!(compiler.is_like_msvc(), "Windows window controls require the MSVC toolchain");
    let status = compiler
        .to_command()
        .current_dir(&out)
        .args(["/nologo", "/LD", "/MT", "/O2", "/EHsc", "/std:c++17"])
        .arg(&source)
        .args(["user32.lib", "comctl32.lib", "/link", "/OUT:window_controls.dll"])
        .status()
        .expect("compile native window controls");
    assert!(status.success(), "native window controls compilation failed");
    if std::env::var_os("CARGO_FEATURE_NATIVE_WINDOW_CONTROLS_TESTS").is_some() {
        println!("cargo:rerun-if-changed=native/window_controls_test.cpp");
        let test_source = source.with_file_name("window_controls_test.cpp");
        let status = compiler
            .to_command()
            .current_dir(&out)
            .args(["/nologo", "/MT", "/EHsc", "/std:c++17"])
            .arg(test_source)
            .args(["user32.lib", "/Fe:window_controls_test.exe"])
            .status()
            .expect("compile native window controls test host");
        assert!(status.success(), "native window controls test compilation failed");
    }
    println!("cargo:rerun-if-changed=../../build/windows/installer/spicetify.ico");

    winresource::WindowsResource::new()
        .set_icon("../../build/windows/installer/spicetify.ico")
        .compile()
        .expect("failed to embed Windows resources");
}

#[cfg(not(windows))]
fn main() {}
