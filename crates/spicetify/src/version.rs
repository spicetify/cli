use semver::Version;

pub struct VersionInfo {
    pub semver: Version,
    display: String,
    full: String,
}

impl VersionInfo {
    pub fn load() -> Self {
        let semver = Version::parse(env!("CARGO_PKG_VERSION"))
            .expect("CARGO_PKG_VERSION must be valid semver");

        let mut display = format!("v{semver}");
        let mut full = format!("v{semver}");

        let sha = option_env!("SPICETIFY_COMMIT_SHA").map(|s| &s[..s.len().min(7)]);
        let build_id = option_env!("SPICETIFY_BUILD_ID");

        match (sha, build_id) {
            (Some(sha), Some(build_id)) => {
                display.push_str(&format!(" ({build_id}.{sha})"));
                full.push_str(&format!("+build.{build_id}.{sha}"));
            }
            (Some(sha), None) => {
                display.push_str(&format!(" ({sha})"));
                full.push_str(&format!("+{sha}"));
            }
            _ => {}
        }

        Self {
            semver,
            display,
            full,
        }
    }

    pub fn display(&self) -> &str {
        &self.display
    }

    pub fn full(&self) -> &str {
        &self.full
    }
}

pub fn current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
