package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ModuleMetadata mirrors the v3 module metadata.json shape (spicetify/modules).
type ModuleMetadata struct {
	Name         string            `json:"name"`
	Tags         []string          `json:"tags"`
	Version      string            `json:"version"`
	Authors      []string          `json:"authors"`
	Description  string            `json:"description"`
	Entries      ModuleEntries     `json:"entries"`
	HasMixins    bool              `json:"hasMixins"`
	Dependencies map[string]string `json:"dependencies"`
	// Compat lists historical versions this module still answers for
	// (e.g. stdlib 1.0.0 declaring ["0.3.0"]); the loader loads dependents
	// whose declared range admits one of them. Must survive into the
	// manifest or the loader never sees the vouch.
	Compat []string `json:"compat,omitempty"`
}

// UnmarshalJSON tolerates dependencies as either a map or an (empty) array,
// both used by historical module metadata.
func (m *ModuleMetadata) UnmarshalJSON(data []byte) error {
	type plain ModuleMetadata
	var raw struct {
		plain
		Dependencies json.RawMessage `json:"dependencies"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	*m = ModuleMetadata(raw.plain)
	m.Dependencies = map[string]string{}
	if len(raw.Dependencies) > 0 && string(raw.Dependencies) != "null" {
		trimmed := strings.TrimSpace(string(raw.Dependencies))
		if strings.HasPrefix(trimmed, "{") {
			if err := json.Unmarshal(raw.Dependencies, &m.Dependencies); err != nil {
				return fmt.Errorf("dependencies: %w", err)
			}
		}
	}
	return nil
}

type ModuleEntries struct {
	JS  string `json:"js,omitempty"`
	CSS string `json:"css,omitempty"`
}

// ModuleManifest is one module in the runtime manifest (TS ManifestModule).
type ModuleManifest struct {
	Identifier string `json:"identifier"`
	ModuleMetadata
}

// ModulesManifest is consumed by jsHelper/modularLoader.js at boot.
type ModulesManifest struct {
	SpotifyVersion   string           `json:"spotifyVersion"`
	ClassmapKey      string           `json:"classmapKey"`
	CliVersion       string           `json:"cliVersion,omitempty"`
	UpdatesBlocked   bool             `json:"updatesBlocked"`
	UpdatePolicy     string           `json:"updatePolicy,omitempty"`
	SupportedSpotify string           `json:"supportedSpotify,omitempty"`
	LatestSpotify    string           `json:"latestSpotify,omitempty"`
	ClassmapFallback bool             `json:"classmapFallback,omitempty"`
	Classmap         Classmap         `json:"classmap,omitempty"`
	Modules          []ModuleManifest `json:"modules"`
}

// ModulesDir is where v3 modules are installed inside the spicetify config folder.
func ModulesDir() string {
	return filepath.Join(GetSpicetifyFolder(), "Modules")
}

// DiscoverModules reads <root>/<identifier>/metadata.json for each subfolder.
func DiscoverModules(root string) ([]ModuleManifest, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("cannot read modules dir %s: %w", root, err)
	}

	var modules []ModuleManifest
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		metaPath := filepath.Join(root, e.Name(), "metadata.json")
		raw, err := os.ReadFile(metaPath)
		if err != nil {
			return nil, fmt.Errorf("module %s: %w", e.Name(), err)
		}
		var meta ModuleMetadata
		if err := json.Unmarshal(raw, &meta); err != nil {
			return nil, fmt.Errorf("module %s has malformed metadata.json: %w", e.Name(), err)
		}
		if meta.Version == "" || (meta.Entries.JS == "" && meta.Entries.CSS == "") {
			return nil, fmt.Errorf("module %s metadata must set version and at least one entry", e.Name())
		}
		modules = append(modules, ModuleManifest{Identifier: e.Name(), ModuleMetadata: meta})
	}
	return modules, nil
}

// StageModules remaps module entries against the classmap and stages them
// with the runtime manifest into the extracted xpui dir, so they flow into
// the applied client like any other preprocessed asset.
// A module that fails to remap is skipped with a warning, not fatal.
func StageModules(modulesRoot, extractedXpuiPath string, modules []ModuleManifest, cm Classmap, stale map[string]bool, spotifyVersion, classmapKey string, env ManifestEnv) (*ModulesManifest, error) {
	manifest := &ModulesManifest{
		SpotifyVersion:   spotifyVersion,
		ClassmapKey:      classmapKey,
		CliVersion:       env.CliVersion,
		UpdatesBlocked:   env.UpdatesBlocked,
		UpdatePolicy:     env.UpdatePolicy,
		SupportedSpotify: env.SupportedSpotify,
		LatestSpotify:    env.LatestSpotify,
		ClassmapFallback: env.ClassmapFallback,
		Classmap:         cm,
	}

	for _, m := range modules {
		outDir := filepath.Join(extractedXpuiPath, "modules", m.Identifier)
		staged := ModuleManifest{Identifier: m.Identifier, ModuleMetadata: m.ModuleMetadata}

		os.RemoveAll(outDir)
		if err := stageModuleTree(modulesRoot, m.Identifier, outDir, cm, stale); err != nil {
			os.RemoveAll(outDir)
			PrintWarning(fmt.Sprintf("Skipping module %s: %v", m.Identifier, err))
			continue
		}
		manifest.Modules = append(manifest.Modules, staged)
	}

	if len(manifest.Modules) == 0 {
		return manifest, nil
	}

	manifestJSON, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return nil, err
	}
	manifestPath := filepath.Join(extractedXpuiPath, "modules", "manifest.json")
	if err := os.MkdirAll(filepath.Dir(manifestPath), 0755); err != nil {
		return nil, err
	}
	if err := os.WriteFile(manifestPath, manifestJSON, 0644); err != nil {
		return nil, fmt.Errorf("cannot write modules manifest: %w", err)
	}
	return manifest, nil
}

// stageModuleTree stages a whole module directory, remapping text sources
// and copying everything else verbatim.
func stageModuleTree(modulesRoot, identifier, outDir string, cm Classmap, stale map[string]bool) error {
	srcRoot := filepath.Join(modulesRoot, identifier)
	return filepath.WalkDir(srcRoot, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(srcRoot, path)
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if rel == "metadata.json" || rel == "spicetify-module.json" {
			return nil
		}
		destDir := filepath.Join(outDir, filepath.Dir(rel))
		switch strings.ToLower(filepath.Ext(rel)) {
		case ".js", ".mjs", ".css", ".ts", ".tsx", ".jsx":
			if _, err := stageEntry(modulesRoot, identifier, rel, destDir, cm, stale); err != nil {
				return err
			}
		default:
			raw, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			if err := os.MkdirAll(destDir, 0755); err != nil {
				return err
			}
			if err := os.WriteFile(filepath.Join(outDir, rel), raw, 0644); err != nil {
				return err
			}
		}
		return nil
	})
}

func stageEntry(modulesRoot, identifier, entry, outDir string, cm Classmap, stale map[string]bool) (string, error) {
	return remapModuleEntry(filepath.Join(modulesRoot, identifier, entry), outDir, cm, stale)
}

// remapModuleEntry remaps one entry file into the staging dir and returns
// the staged file name (same as the entry name).
func remapModuleEntry(srcPath, outDir string, cm Classmap, stale map[string]bool) (string, error) {
	raw, err := os.ReadFile(srcPath)
	if err != nil {
		return "", fmt.Errorf("cannot read %s: %w", srcPath, err)
	}
	remapped, err := RemapClassmapReferencesWithOptions(string(raw), cm, RemapOptions{StalePaths: stale})
	if err != nil {
		return "", err
	}
	return writeStagedEntry(srcPath, outDir, remapped)
}

func writeStagedEntry(srcPath, outDir, content string) (string, error) {
	if err := os.MkdirAll(outDir, 0755); err != nil {
		return "", err
	}
	name := filepath.Base(srcPath)
	if err := os.WriteFile(filepath.Join(outDir, name), []byte(content), 0644); err != nil {
		return "", fmt.Errorf("cannot stage %s: %w", name, err)
	}
	return name, nil
}

// ClassmapStalePathsFromMeta reads stale_leaves from a META.json next to a
// classmap, if present. Missing META is not an error.
func ClassmapStalePathsFromMeta(classmapPath string) map[string]bool {
	raw, err := os.ReadFile(filepath.Join(filepath.Dir(classmapPath), "META.json"))
	if err != nil {
		return nil
	}
	var meta struct {
		StaleLeaves []string `json:"stale_leaves"`
	}
	if json.Unmarshal(raw, &meta) != nil {
		return nil
	}
	stale := map[string]bool{}
	for _, p := range meta.StaleLeaves {
		stale[p] = true
	}
	return stale
}

// HasModularApplyInput reports whether a modular apply can run: modules
// installed, and the version has a classmap staged under the search dirs.
func HasModularApplyInput(classmapKey string) bool {
	if modules, err := DiscoverModules(ModulesDir()); err != nil || len(modules) == 0 {
		return false
	}
	_, err := FindClassmapFile(classmapKey)
	return err == nil
}

// ModularApplyScriptTag is injected into index.html for modular applies.
const ModularApplyScriptTag = "<script src='helper/modularLoader.js'></script>\n"

// StageModularApply is the full apply-time pipeline: discover, remap, stage.
// Returns nil manifest (and nil error) when there is nothing to do.
// ManifestEnv carries apply-time environment facts the client cannot
// observe on its own; they ride the manifest for management UIs.
type ManifestEnv struct {
	CliVersion       string
	UpdatesBlocked   bool
	UpdatePolicy     string
	SupportedSpotify string
	LatestSpotify    string
	ClassmapFallback bool
}

// RestampManifestEnv rewrites the apply-time environment fields in an
// already-staged modules manifest. The manifest is written at backup time,
// but update blocking follows live config on every apply; without the
// re-stamp the client shows the pre-toggle state until the next backup.
func RestampManifestEnv(manifestPath string, env ManifestEnv) error {
	raw, err := os.ReadFile(manifestPath)
	if err != nil {
		return err
	}
	var manifest map[string]any
	if err := json.Unmarshal(raw, &manifest); err != nil {
		return err
	}
	if env.CliVersion != "" {
		manifest["cliVersion"] = env.CliVersion
	} else {
		delete(manifest, "cliVersion")
	}
	manifest["updatesBlocked"] = env.UpdatesBlocked
	setOrDelete := func(key, value string) {
		if value != "" {
			manifest[key] = value
		} else {
			delete(manifest, key)
		}
	}
	setOrDelete("updatePolicy", env.UpdatePolicy)
	setOrDelete("supportedSpotify", env.SupportedSpotify)
	setOrDelete("latestSpotify", env.LatestSpotify)
	out, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(manifestPath, out, 0644)
}

func StageModularApply(extractedXpuiPath, spotifyVersion, classmapKey string, env ManifestEnv) (*ModulesManifest, error) {
	modules, err := DiscoverModules(ModulesDir())
	if err != nil {
		return nil, err
	}
	if len(modules) == 0 {
		return nil, nil
	}
	classmapPath, err := FindClassmapFile(classmapKey)
	if err != nil {
		return nil, err
	}
	cm, err := LoadClassmap(classmapPath)
	if err != nil {
		return nil, err
	}
	stale := ClassmapStalePathsFromMeta(classmapPath)
	manifest, err := StageModules(ModulesDir(), extractedXpuiPath, modules, cm, stale, spotifyVersion, classmapKey, env)
	if err != nil || manifest == nil || len(manifest.Modules) == 0 {
		return manifest, err
	}
	return manifest, nil
}
