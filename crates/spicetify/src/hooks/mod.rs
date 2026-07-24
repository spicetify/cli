pub mod manifest;
pub mod version_detect;

pub use manifest::{HookSet, http_client};

use crate::context::AppContext;

#[derive(Debug, Clone)]
pub struct ResolvedHookSets {
    pub spotify_version: Option<semver::Version>,
    pub matching: Vec<HookSet>,
    pub all: Vec<HookSet>,
}

impl ResolvedHookSets {
    #[must_use]
    pub fn has_exactly_one_match(&self) -> bool {
        self.matching.len() == 1
    }

    #[must_use]
    pub fn single_match(&self) -> Option<&HookSet> {
        if self.matching.len() == 1 { self.matching.first() } else { None }
    }
}

pub fn resolve_hook_sets(sets: Vec<HookSet>, ctx: &AppContext) -> ResolvedHookSets {
    let spotify_version = version_detect::detect_spotify_version(ctx).ok();

    let matching: Vec<HookSet> = spotify_version.as_ref().map_or_else(Vec::new, |v| {
        sets.iter().filter(|set| set.matches_version(v)).cloned().collect()
    });

    ResolvedHookSets { spotify_version, matching, all: sets }
}
