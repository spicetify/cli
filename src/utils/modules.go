package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
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
	SpotifyVersion string           `json:"spotifyVersion"`
	ClassmapKey    string           `json:"classmapKey"`
	Modules        []ModuleManifest `json:"modules"`
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
func StageModules(modulesRoot, extractedXpuiPath string, modules []ModuleManifest, cm Classmap, stale map[string]bool, spotifyVersion, classmapKey string) (*ModulesManifest, error) {
	manifest := &ModulesManifest{
		SpotifyVersion: spotifyVersion,
		ClassmapKey:    classmapKey,
	}

	for _, m := range modules {
		outDir := filepath.Join(extractedXpuiPath, "modules", m.Identifier)
		staged := ModuleManifest{Identifier: m.Identifier, ModuleMetadata: m.ModuleMetadata}

		ok := true
		if m.Entries.JS != "" {
			out, err := remapModuleEntry(filepath.Join(modulesRoot, m.Identifier, m.Entries.JS), outDir, cm, stale)
			if err != nil {
				PrintWarning(fmt.Sprintf("Skipping module %s: %v", m.Identifier, err))
				ok = false
			} else {
				staged.Entries.JS = out
			}
		}
		if ok && m.Entries.CSS != "" {
			out, err := remapModuleEntry(filepath.Join(modulesRoot, m.Identifier, m.Entries.CSS), outDir, cm, stale)
			if err != nil {
				PrintWarning(fmt.Sprintf("Skipping css for module %s: %v", m.Identifier, err))
				staged.Entries.CSS = ""
			} else {
				staged.Entries.CSS = out
			}
		}

		if ok {
			manifest.Modules = append(manifest.Modules, staged)
		}
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
	if err := os.MkdirAll(outDir, 0755); err != nil {
		return "", err
	}
	name := filepath.Base(srcPath)
	if err := os.WriteFile(filepath.Join(outDir, name), []byte(remapped), 0644); err != nil {
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
func StageModularApply(extractedXpuiPath, spotifyVersion, classmapKey string) (*ModulesManifest, error) {
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
	return StageModules(ModulesDir(), extractedXpuiPath, modules, cm, stale, spotifyVersion, classmapKey)
}
