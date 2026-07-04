pub type Result<T> = anyhow::Result<T>;

#[must_use]
pub fn format_chain(err: &anyhow::Error) -> String {
    use std::fmt::Write;
    let mut out = String::new();
    for (i, cause) in err.chain().enumerate() {
        if i == 0 {
            out.push_str(&cause.to_string());
        } else {
            let _ = write!(out, "\n  caused by: {cause}");
        }
    }
    out
}
