package utils

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeModule(t *testing.T, root, id, metadata, js, css string) {
	t.Helper()
	dir := filepath.Join(root, id)
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "metadata.json"), []byte(metadata), 0600); err != nil {
		t.Fatal(err)
	}
	if js != "" {
		if err := os.WriteFile(filepath.Join(dir, "index.js"), []byte(js), 0600); err != nil {
			t.Fatal(err)
		}
	}
	if css != "" {
		if err := os.WriteFile(filepath.Join(dir, "index.css"), []byte(css), 0600); err != nil {
			t.Fatal(err)
		}
	}
}

const testMetadata = `{
  "name": "hello",
  "tags": ["dev"],
  "version": "0.1.0",
  "authors": ["spicetify"],
  "description": "test",
  "entries": {"js": "index.js", "css": "index.css"},
  "hasMixins": false,
  "dependencies": {}
}`

func TestDiscoverModules(t *testing.T) {
	root := t.TempDir()
	writeModule(t, root, "hello", testMetadata, `export function load() {}`, `.x{color:red}`)

	modules, err := DiscoverModules(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(modules) != 1 {
		t.Fatalf("expected 1 module, got %d", len(modules))
	}
	m := modules[0]
	if m.Identifier != "hello" || m.Version != "0.1.0" || m.Entries.JS != "index.js" {
		t.Fatalf("unexpected manifest: %+v", m)
	}

	if _, err := DiscoverModules(filepath.Join(root, "nope")); err != nil {
		t.Fatalf("missing root should give nil, not error: %v", err)
	}
}

func TestDiscoverModulesRejectsBadMetadata(t *testing.T) {
	root := t.TempDir()
	writeModule(t, root, "bad", `{"name": "bad"}`, "", "")
	if _, err := DiscoverModules(root); err == nil {
		t.Fatal("expected error for metadata without version/entries")
	}
}

func TestStageModules(t *testing.T) {
	modulesRoot := t.TempDir()
	writeModule(t, modulesRoot, "hello", testMetadata,
		`export function load() { document.body.classList.add(MAP.main.topbar.wrapper); }`,
		`.x { color: red; }`)

	cm := Classmap{"main": map[string]any{"topbar": map[string]any{"wrapper": "hashTop1"}}}
	xpui := t.TempDir()

	manifest, err := StageModules(modulesRoot, xpui,
		[]ModuleManifest{{Identifier: "hello", ModuleMetadata: ModuleMetadata{
			Name: "hello", Version: "0.1.0", Entries: ModuleEntries{JS: "index.js", CSS: "index.css"},
		}}},
		cm, nil, "1.2.94", "1020094", ManifestEnv{CliVersion: "2.99.0", UpdatesBlocked: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(manifest.Modules) != 1 {
		t.Fatalf("expected 1 staged module, got %d", len(manifest.Modules))
	}

	stagedJS, err := os.ReadFile(filepath.Join(xpui, "modules", "hello", "index.js"))
	if err != nil {
		t.Fatal(err)
	}
	if want := `"hashTop1"`; !strings.Contains(string(stagedJS), want) {
		t.Fatalf("staged js not remapped, want %q in:\n%s", want, stagedJS)
	}

	rawManifest, err := os.ReadFile(filepath.Join(xpui, "modules", "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	var decoded ModulesManifest
	if err := json.Unmarshal(rawManifest, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.ClassmapKey != "1020094" || decoded.SpotifyVersion != "1.2.94" {
		t.Fatalf("bad manifest header: %+v", decoded)
	}
	if decoded.CliVersion != "2.99.0" || !decoded.UpdatesBlocked {
		t.Fatalf("manifest env fields not written: %+v", decoded)
	}
	if !strings.Contains(string(rawManifest), `"updatesBlocked": true`) {
		t.Fatalf("updatesBlocked missing from serialized manifest:\n%s", rawManifest)
	}
	if decoded.Modules[0].Entries.CSS != "index.css" {
		t.Fatalf("css entry missing from manifest: %+v", decoded.Modules[0])
	}
}

func TestStageModulesSkipsFailedRemap(t *testing.T) {
	modulesRoot := t.TempDir()
	writeModule(t, modulesRoot, "broken", testMetadata, `const a = MAP.does.not.exist;`, "")

	cm := Classmap{"main": map[string]any{"topbar": map[string]any{"wrapper": "hashTop1"}}}
	manifest, err := StageModules(modulesRoot, t.TempDir(),
		[]ModuleManifest{{Identifier: "broken", ModuleMetadata: ModuleMetadata{
			Name: "broken", Version: "0.1.0", Entries: ModuleEntries{JS: "index.js"},
		}}},
		cm, nil, "1.2.94", "1020094", ManifestEnv{})
	if err != nil {
		t.Fatal(err)
	}
	if len(manifest.Modules) != 0 {
		t.Fatalf("broken module should be skipped, got %+v", manifest.Modules)
	}
}

func TestModuleMetadataDependenciesArray(t *testing.T) {
	var m ModuleMetadata
	if err := json.Unmarshal([]byte(`{"name":"stdlib","version":"0.2.2","dependencies":[]}`), &m); err != nil {
		t.Fatal(err)
	}
	if len(m.Dependencies) != 0 {
		t.Fatalf("array dependencies should give empty map, got %v", m.Dependencies)
	}

	raw := `{"name":"x","version":"1.0.0","dependencies":{"stdlib":"^0.2.0"}}`
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		t.Fatal(err)
	}
	if m.Dependencies["stdlib"] != "^0.2.0" {
		t.Fatalf("map dependencies broken: %v", m.Dependencies)
	}
}

func TestModuleMetadataCompatRoundTrips(t *testing.T) {
	var m ModuleMetadata
	raw := `{"name":"stdlib","version":"1.0.0","dependencies":{},"compat":["0.3.0"]}`
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		t.Fatal(err)
	}
	if len(m.Compat) != 1 || m.Compat[0] != "0.3.0" {
		t.Fatalf("compat not parsed: %v", m.Compat)
	}
	// The vouch must survive re-marshalling into the manifest, or the
	// loader never sees it.
	out, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(out), `"compat":["0.3.0"]`) {
		t.Fatalf("compat dropped on marshal: %s", out)
	}
	// And omitted entirely when absent, keeping manifests unchanged for
	// modules that declare nothing.
	var plainMod ModuleMetadata
	if err := json.Unmarshal([]byte(`{"name":"x","version":"1.0.0","dependencies":{}}`), &plainMod); err != nil {
		t.Fatal(err)
	}
	out, err = json.Marshal(plainMod)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(out), "compat") {
		t.Fatalf("empty compat should be omitted: %s", out)
	}
}

func TestRewriteFacadeImports(t *testing.T) {
	dir := t.TempDir()
	shimmed := map[string]bool{"wpunpk.mix-ABC.js": true}
	files := map[string]string{
		"wpunpk.mix-ABC.js": `export const webpackRequire = {};`,
		"wpunpk.mix-DEF.js": `import { a as webpackRequire, t as chunkLoadedSubjectPost } from "./wpunpk.mix-ABC.js";
export { webpackRequire, chunkLoadedSubjectPost };`,
		"other.js": `import { a as somethingElse } from "./other-dep.js";`,
	}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
	}

	if err := rewriteFacadeImports(dir, shimmed); err != nil {
		t.Fatal(err)
	}

	facade, _ := os.ReadFile(filepath.Join(dir, "wpunpk.mix-DEF.js"))
	got := string(facade)
	if !strings.Contains(got, "import { webpackRequire, chunkLoadedSubjectPost } from") {
		t.Fatalf("aliases not collapsed:\n%s", got)
	}
	other, _ := os.ReadFile(filepath.Join(dir, "other.js"))
	if !strings.Contains(string(other), "a as somethingElse") {
		t.Fatalf("unrelated import was rewritten:\n%s", other)
	}
}

func TestManifestEnvHonestSerialization(t *testing.T) {
	modulesRoot := t.TempDir()
	writeModule(t, modulesRoot, "plain", testMetadata, `export function load() {}`, `.x {}`)
	xpui := t.TempDir()

	_, err := StageModules(modulesRoot, xpui,
		[]ModuleManifest{{Identifier: "plain", ModuleMetadata: ModuleMetadata{
			Name: "plain", Version: "0.1.0", Entries: ModuleEntries{JS: "index.js"},
		}}},
		Classmap{}, nil, "1.2.94", "1020094", ManifestEnv{})
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(xpui, "modules", "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "cliVersion") {
		t.Fatalf("empty cliVersion must be omitted, got:\n%s", raw)
	}
	if !strings.Contains(string(raw), `"updatesBlocked": false`) {
		t.Fatalf("updatesBlocked:false must serialize explicitly, got:\n%s", raw)
	}
}

func TestRestampManifestEnv(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "manifest.json")
	seed := `{"spotifyVersion":"1.2.94","classmapKey":"1020094","updatesBlocked":false,"modules":[{"identifier":"m"}]}`
	if err := os.WriteFile(path, []byte(seed), 0644); err != nil {
		t.Fatal(err)
	}
	if err := RestampManifestEnv(path, ManifestEnv{
		CliVersion:       "3.0.0",
		UpdatesBlocked:   true,
		UpdatePolicy:     "gate",
		SupportedSpotify: "1.2.94.583",
		LatestSpotify:    "1.2.95.100",
	}); err != nil {
		t.Fatal(err)
	}
	raw, _ := os.ReadFile(path)
	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded["cliVersion"] != "3.0.0" || decoded["updatesBlocked"] != true {
		t.Fatalf("restamp did not apply: %+v", decoded)
	}
	if decoded["updatePolicy"] != "gate" || decoded["supportedSpotify"] != "1.2.94.583" || decoded["latestSpotify"] != "1.2.95.100" {
		t.Fatalf("restamp did not apply gate fields: %+v", decoded)
	}
	// Empty gate fields must be deleted, not written blank.
	if err := RestampManifestEnv(path, ManifestEnv{CliVersion: "3.0.0", UpdatesBlocked: true}); err != nil {
		t.Fatal(err)
	}
	raw, _ = os.ReadFile(path)
	if strings.Contains(string(raw), "updatePolicy") || strings.Contains(string(raw), "latestSpotify") {
		t.Fatalf("empty gate fields must be omitted, got:\n%s", raw)
	}
	modules, ok := decoded["modules"].([]any)
	if !ok || len(modules) != 1 || modules[0].(map[string]any)["identifier"] != "m" {
		t.Fatalf("restamp corrupted module entries: %+v", decoded["modules"])
	}
}
