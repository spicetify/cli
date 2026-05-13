fn main() {
    if cfg!(target_os = "windows") {
        let mut res = winres::WindowsResource::new();
        res.set_icon("../../build/windows/installer/spicetify.ico");
        res.set("ProductName", "Spicetify");
        res.set("FileDescription", "Spicetify");
        res.set("LegalCopyright", "Spicetify");
        res.compile().unwrap();
    }
}
