package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
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
	SpotifyVersion string           `json:"spotifyVersion"`
	ClassmapKey    string           `json:"classmapKey"`
	CliVersion     string           `json:"cliVersion,omitempty"`
	UpdatesBlocked bool             `json:"updatesBlocked"`
	Classmap       Classmap         `json:"classmap,omitempty"`
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
func StageModules(modulesRoot, extractedXpuiPath string, modules []ModuleManifest, cm Classmap, stale map[string]bool, spotifyVersion, classmapKey string, env ManifestEnv) (*ModulesManifest, error) {
	manifest := &ModulesManifest{
		SpotifyVersion: spotifyVersion,
		ClassmapKey:    classmapKey,
		CliVersion:     env.CliVersion,
		UpdatesBlocked: env.UpdatesBlocked,
		Classmap:       cm,
	}

	for _, m := range modules {
		outDir := filepath.Join(extractedXpuiPath, "modules", m.Identifier)
		staged := ModuleManifest{Identifier: m.Identifier, ModuleMetadata: m.ModuleMetadata}

		// pkg artifacts are pre-tailored for a base classmap; re-aim them at
		// the target. Source modules (MAP.* references) remap directly.
		sidecar := readModuleSidecar(modulesRoot, m.Identifier)
		base := sidecar.ClassmapBase
		hooksEra := base != ""
		var baseCm Classmap
		retarget := false
		if base != "" && base != classmapKey {
			basePath, err := FindClassmapFile(base)
			if err != nil {
				PrintWarning(fmt.Sprintf("Skipping module %s: built for classmap %s, which is not available locally", m.Identifier, base))
				continue
			}
			if baseCm, err = LoadClassmap(basePath); err != nil {
				PrintWarning(fmt.Sprintf("Skipping module %s: %v", m.Identifier, err))
				continue
			}
			retarget = true
		}

		os.RemoveAll(outDir)
		if err := stageModuleTree(modulesRoot, m.Identifier, outDir, baseCm, cm, stale, retarget, sidecar.AllowStale, hooksEra); err != nil {
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

// moduleSidecar is written by `spicetify pkg install` next to metadata.json.
type moduleSidecar struct {
	InstalledVersion string `json:"installed_version"`
	ClassmapBase     string `json:"classmap_base"`
	AllowStale       bool   `json:"allow_stale,omitempty"`
}

func readModuleSidecar(modulesRoot, identifier string) moduleSidecar {
	raw, err := os.ReadFile(filepath.Join(modulesRoot, identifier, "spicetify-module.json"))
	if err != nil {
		return moduleSidecar{}
	}
	var sc moduleSidecar
	if json.Unmarshal(raw, &sc) != nil {
		return moduleSidecar{}
	}
	return sc
}

// hooksEraPlatformShim replaces src/expose/Platform.js in hooks-era
// artifacts: the original exposes the Platform object through a runtime
// source transform of the client core bundle, which never executes on
// snapshot builds. The wrapper already captures the same object at runtime.
const hooksEraPlatformShim = `// Rewritten at staging time by spicetify (hooks-era artifact compat).
// The original exposes Platform via a runtime source transform of the client
// core bundle, which never executes on snapshot builds. Resolve lazily: the
// mixin phase imports this module before the client (and Spicetify._platform)
// exists, so capture must happen on first use, not at import time.
let cached;
function resolvePlatform() {
	if (cached === undefined) {
		cached = globalThis.Spicetify?._platform ?? null;
	}
	return cached ?? undefined;
}

export const Platform = new Proxy({}, {
	get: (_, key) => {
		const p = resolvePlatform();
		if (!p) return undefined;
		if (key in p) return p[key];
		if (typeof key === "string" && key.startsWith("get") && typeof p.getRegistry === "function") {
			const description = key.slice(3);
			for (const s of p.getRegistry()._map.keys()) {
				if (s.description === description) return () => p.getRegistry().resolve(s);
			}
		}
		return undefined;
	},
	has: (_, key) => {
		const p = resolvePlatform();
		if (!p) return false;
		if (key in p) return true;
		if (typeof key === "string" && key.startsWith("get") && typeof p.getRegistry === "function") {
			const description = key.slice(3);
			for (const s of p.getRegistry()._map.keys()) {
				if (s.description === description) return true;
			}
		}
		return false;
	},
});
`

// hooksEraCompatPatches maps module-relative paths to replacement content
// applied to hooks-era (retargeted) artifacts at staging time.
const hooksEraWpunpkShim = `// Rewritten at staging time by spicetify (hooks-era artifact compat).
// The original registers a capture chunk in the chunk array before the
// client boots, which is fatal to the snapshot runtime. The modular loader
// captures __webpack_require__ itself once the client is up; this module
// forwards to it lazily and keeps the hooks-era contract intact.

class Subject {
	constructor() {
		this.observers = new Set();
	}
	subscribe(fn) {
		this.observers.add(fn);
		return { unsubscribe: () => this.observers.delete(fn) };
	}
	next(value) {
		for (const fn of this.observers) fn(value);
	}
}

class BehaviorSubject extends Subject {
	constructor(value) {
		super();
		this.value = value;
	}
	subscribe(fn) {
		const sub = super.subscribe(fn);
		fn(this.value);
		return sub;
	}
	next(value) {
		this.value = value;
		super.next(value);
	}
	getValue() {
		return this.value;
	}
}

export { Subject, BehaviorSubject };

export const chunkLoadedSubjectPre = new Subject();
export const chunkLoadedSubjectPost = new Subject();
export const moduleLoadedSubject = new Subject();

const pendingHooks = [];
export const postWebpackRequireHooks = {
	push(hook) {
		if (typeof globalThis.__webpack_require__ === "function") {
			try {
				hook(globalThis.__webpack_require__);
			} catch (e) {
				console.error(e);
			}
			return 0;
		}
		pendingHooks.push(hook);
		return pendingHooks.length;
	},
};

export const webpackRequire = new Proxy(function () {}, {
	get: (_, k) => globalThis.__webpack_require__?.[k] ?? (k === "m" ? {} : undefined),
	apply: (_, __, args) => globalThis.__webpack_require__(...args),
});

const drain = () => {
	if (typeof globalThis.__webpack_require__ !== "function") return false;
	for (const hook of pendingHooks.splice(0)) {
		try {
			hook(globalThis.__webpack_require__);
		} catch (e) {
			console.error(e);
		}
	}
	return true;
};
let tries = 0;
const timer = setInterval(() => {
	if (drain() || ++tries > 400) clearInterval(timer);
}, 50);
`

// hooksEraCompatPatchFor returns the replacement shim for hooks-era module
// files, detected by content (layout-proof: works for both the 2024
// src-tree artifacts and flat bundled layouts).
func hooksEraCompatPatchFor(content string) string {
	switch {
	case strings.Contains(content, "__Platform={"):
		return hooksEraPlatformShim
	case strings.Contains(content, "webpackChunkclient_web") && strings.Contains(content, "webpackRequire"):
		return hooksEraWpunpkShim
	default:
		return ""
	}
}

func isTextEntry(rel string) bool {
	switch strings.ToLower(filepath.Ext(rel)) {
	case ".js", ".mjs", ".css", ".ts", ".tsx", ".jsx":
		return true
	default:
		return false
	}
}

// stageModuleTree stages a whole module directory, remapping text sources
// and copying everything else verbatim.
// Compat patches apply to any hooks-era artifact (sidecar present),
// whether or not the base classmap differs from the target.
func stageModuleTree(modulesRoot, identifier, outDir string, baseCm, cm Classmap, stale map[string]bool, retarget, allowStale, hooksEra bool) error {
	srcRoot := filepath.Join(modulesRoot, identifier)
	shimmed := map[string]bool{}
	err := filepath.WalkDir(srcRoot, func(path string, d os.DirEntry, err error) error {
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
		if hooksEra && isTextEntry(rel) {
			content, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			if replacement := hooksEraCompatPatchFor(string(content)); replacement != "" {
				if err := os.MkdirAll(destDir, 0755); err != nil {
					return err
				}
				shimmed[filepath.Base(rel)] = true
				return os.WriteFile(filepath.Join(outDir, rel), []byte(replacement), 0644)
			}
		}
		switch strings.ToLower(filepath.Ext(rel)) {
		case ".js", ".mjs", ".css", ".ts", ".tsx", ".jsx":
			if _, err := stageEntry(modulesRoot, identifier, rel, destDir, baseCm, cm, stale, retarget, allowStale); err != nil {
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
	if err != nil {
		return err
	}
	if len(shimmed) > 0 {
		return rewriteFacadeImports(outDir, shimmed)
	}
	return nil
}

// rewriteFacadeImports fixes bundled facades that import from a shimmed
// chunk with minified alias names: the shim exports readable names, so
// `a as webpackRequire` collapses to `webpackRequire`.
var facadeImportRe = regexp.MustCompile(`import\s+\{[^}]+\}\s+from\s+["']\.\/[^"']+["']`)

var aliasRe = regexp.MustCompile(`\b([a-zA-Z_$][\w$]*)\s+as\s+([a-zA-Z_$][\w$]*)`)

func rewriteFacadeImports(outDir string, shimmed map[string]bool) error {
	return filepath.WalkDir(outDir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".js") {
			return err
		}
		if shimmed[filepath.Base(path)] {
			return nil
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		content := string(raw)
		changed := false
		out := facadeImportRe.ReplaceAllStringFunc(content, func(stmt string) string {
			for base := range shimmed {
				if strings.Contains(stmt, base) {
					changed = true
					return aliasRe.ReplaceAllString(stmt, "$2")
				}
			}
			return stmt
		})
		if !changed {
			return nil
		}
		return os.WriteFile(path, []byte(out), 0644)
	})
}

func stageEntry(modulesRoot, identifier, entry, outDir string, baseCm, cm Classmap, stale map[string]bool, retarget, allowStale bool) (string, error) {
	srcPath := filepath.Join(modulesRoot, identifier, entry)
	if retarget {
		if allowStale {
			return retargetModuleEntryLenient(srcPath, outDir, baseCm, cm, stale)
		}
		return retargetModuleEntry(srcPath, outDir, baseCm, cm, stale)
	}
	return remapModuleEntry(srcPath, outDir, cm, stale)
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

// retargetModuleEntry rewrites an entry built against baseCm to the target
// classmap (pkg-installed pre-tailored artifacts).
func retargetModuleEntry(srcPath, outDir string, baseCm, cm Classmap, stale map[string]bool) (string, error) {
	return retargetModuleEntryWith(srcPath, outDir, baseCm, cm, stale, false)
}

func retargetModuleEntryLenient(srcPath, outDir string, baseCm, cm Classmap, stale map[string]bool) (string, error) {
	return retargetModuleEntryWith(srcPath, outDir, baseCm, cm, stale, true)
}

func retargetModuleEntryWith(srcPath, outDir string, baseCm, cm Classmap, stale map[string]bool, lenient bool) (string, error) {
	raw, err := os.ReadFile(srcPath)
	if err != nil {
		return "", fmt.Errorf("cannot read %s: %w", srcPath, err)
	}
	remapped, err := retargetClassmapHashes(string(raw), baseCm, cm, stale, lenient)
	if err != nil {
		return "", err
	}
	// hooks-era artifacts capture webpack require via the webpack 4 chunk
	// global; current clients are rspack-based and use a different name.
	remapped = strings.ReplaceAll(remapped, "webpackChunkclient_web", "rspackChunkclient_web")
	// Registered symbols throw in this runtime's chunk loader, and a
	// constant chunk id goes stale across boots; use a per-boot unique id.
	remapped = strings.ReplaceAll(remapped,
		`Symbol.for("spicetify.webpack.chunk.id")`,
		`(globalThis.__spicetifyChunkId ??= "spicetify.webpack.chunk.id." + Date.now())`)
	// wpunpk.js expects the capture chunk at index 0 with a fixed id; the
	// deferred capture appends it with a unique id, so match by prefix and
	// neutralize the exact-match assertion.
	remapped = strings.ReplaceAll(remapped,
		"if (index === 0) {",
		`if (Array.isArray(chunk[0]) && String(chunk[0][0]).startsWith("spicetify.webpack.chunk.id")) {`)
	remapped = strings.ReplaceAll(remapped, "assertEquals(chunk[0], [", "0 && assertEquals(chunk[0], [")
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
	CliVersion     string
	UpdatesBlocked bool
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
	// hooks-era artifacts import /hooks/* runtime helpers; ship the compat
	// pack so they resolve inside the client.
	if hooksDir := filepath.Join(GetJsHelperDir(), "hooks"); dirExists(hooksDir) {
		if err := Copy(hooksDir, filepath.Join(extractedXpuiPath, "hooks"), true, nil); err != nil {
			PrintWarning("cannot stage hooks compat pack: " + err.Error())
		}
	}
	return manifest, nil
}

func dirExists(path string) bool {
	st, err := os.Stat(path)
	return err == nil && st.IsDir()
}
