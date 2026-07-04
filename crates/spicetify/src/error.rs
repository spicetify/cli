use std::fmt;

pub type Result<T> = anyhow::Result<T>;

#[derive(Debug)]
pub struct HttpStatusError {
    pub status: u16,
    source: anyhow::Error,
}

impl fmt::Display for HttpStatusError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.source)
    }
}

impl std::error::Error for HttpStatusError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        Some(self.source.as_ref())
    }
}

pub fn http_error(status: u16, msg: impl fmt::Display) -> anyhow::Error {
    HttpStatusError { status, source: anyhow::anyhow!("{msg}") }.into()
}

pub fn wrap_error(source: impl Into<anyhow::Error>, status: u16) -> anyhow::Error {
    HttpStatusError { status, source: source.into() }.into()
}

#[must_use]
pub fn get_http_status(err: &anyhow::Error) -> Option<u16> {
    for cause in err.chain() {
        if let Some(hse) = cause.downcast_ref::<HttpStatusError>() {
            return Some(hse.status);
        }
    }
    None
}

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
