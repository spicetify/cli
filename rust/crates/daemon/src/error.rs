use std::fmt;

#[derive(Debug)]
#[expect(dead_code, reason = "Debug is required by the std::error::Error bound")]
struct HttpStatusError {
    status: u16,
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

pub(crate) fn http_error(status: u16, msg: impl fmt::Display) -> anyhow::Error {
    HttpStatusError { status, source: anyhow::anyhow!("{msg}") }.into()
}
