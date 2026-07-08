#[cfg(windows)]
fn main() {
    println!("cargo:rerun-if-changed=../../build/windows/installer/spicetify.ico");

    winresource::WindowsResource::new()
        .set_icon("../../build/windows/installer/spicetify.ico")
        .compile()
        .expect("failed to embed Windows resources");
}

#[cfg(not(windows))]
fn main() {}
