// TODO: wire Metadata into the install flow and vault
// Go's module/module.go Artifact interface has GetMetdata() (typo: "Metdata") which fetches
// metadata.json from the artifact URL stem. The Metadata struct (name, version, authors,
// description, tags, entries, hasMixins, dependencies) is used by the marketplace UI
// (hooks/module.ts) for display and dependency resolution.
//
// Currently this file is not declared in mod.rs (no `mod metadata;`), making it un-compiled
// dead code. Steps to implement:
// 1. Add `pub mod metadata;` to module/mod.rs
// 2. Fetch metadata.json alongside artifact.zip during install
// 3. Store metadata in the vault Store struct (or alongside in the store directory)
// 4. Expose metadata via the daemon RPC for the marketplace UI

use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataEntries {
    pub js: String,
    pub css: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub name: String,
    pub version: String,
    pub authors: Vec<String>,
    pub description: String,
    pub tags: Vec<String>,
    pub entries: MetadataEntries,
    #[serde(rename = "hasMixins")]
    pub has_mixins: bool,
    pub dependencies: std::collections::BTreeMap<String, String>,
}
