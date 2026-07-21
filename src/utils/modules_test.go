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
		cm, nil, "1.2.94", "1020094")
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
		cm, nil, "1.2.94", "1020094")
	if err != nil {
		t.Fatal(err)
	}
	if len(manifest.Modules) != 0 {
		t.Fatalf("broken module should be skipped, got %+v", manifest.Modules)
	}
}
