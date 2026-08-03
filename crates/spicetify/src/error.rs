pub type Result<T> = anyhow::Result<T>;

#[must_use]
pub fn format_chain(err: &anyhow::Error) -> String {
    use std::fmt::Write;
    let mut out = String::new();
    for (i, cause) in err.chain().enumerate() {
        if i == 0 {
            out.push_str(&cause.to_string());
        } else {
            write!(out, "\n  caused by: {cause}").expect("writing to a String is infallible");
        }
    }
    out
}
