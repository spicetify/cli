pub mod manifest;
pub mod version_detect;

pub use manifest::{HookSet, blocking_client};

use crate::context::AppContext;

#[derive(Debug, Clone)]
pub struct ResolvedHookSets {
    pub spotify_version: Option<semver::Version>,
    pub matching: Vec<HookSet>,
    pub all: Vec<HookSet>,
}

impl ResolvedHookSets {
    #[must_use]
    pub fn best_match(&self) -> Option<HookSet> {
        if self.matching.is_empty() {
            return None;
        }
        let mut sorted = self.matching.clone();
        sorted.sort_by(|a, b| {
            let va = semver::Version::parse(&a.hooks_version).ok();
            let vb = semver::Version::parse(&b.hooks_version).ok();
            vb.cmp(&va)
        });
        sorted.into_iter().next()
    }
}

pub fn resolve_hook_sets(sets: Vec<HookSet>, ctx: &AppContext) -> ResolvedHookSets {
    let spotify_version = version_detect::detect_spotify_version(ctx).ok();

    let matching: Vec<HookSet> = spotify_version.as_ref().map_or_else(Vec::new, |v| {
        sets.iter().filter(|set| set.matches_version(v)).cloned().collect()
    });

    ResolvedHookSets { spotify_version, matching, all: sets }
}
