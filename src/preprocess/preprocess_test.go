package preprocess

import (
	"os"
	"path/filepath"
	"testing"
)

func writeOverlay(t *testing.T, root, key, content string) {
	t.Helper()
	dir := filepath.Join(root, key)
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "css-map.json"), []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
}

func TestApplyCssMapOverlayFromRoots(t *testing.T) {
	root := t.TempDir()
	writeOverlay(t, root, "1020094", `{"newHashAA":"x-settings-section"}`)

	m := map[string]string{
		"oldHashBB": "main-topBar-topbarContent",
		"newHashAA": "outdated-global-name",
	}
	applyCssMapOverlayFromRoots(m, "1020094", "1.2.94.583", []string{root})

	if m["newHashAA"] != "x-settings-section" {
		t.Fatalf("overlay must win over the global map, got %q", m["newHashAA"])
	}
	if m["oldHashBB"] != "main-topBar-topbarContent" {
		t.Fatalf("untouched entry changed: %q", m["oldHashBB"])
	}
}

func TestApplyCssMapOverlayFromRootsMissing(t *testing.T) {
	m := map[string]string{"a": "b"}
	applyCssMapOverlayFromRoots(m, "1020094", "1.2.94", []string{t.TempDir()})
	if m["a"] != "b" || len(m) != 1 {
		t.Fatalf("map changed without overlay: %+v", m)
	}
}

func TestApplyCssMapOverlayFromRootsMalformed(t *testing.T) {
	root := t.TempDir()
	writeOverlay(t, root, "1020094", `{"a": {"nested": true}}`)

	m := map[string]string{"a": "b"}
	applyCssMapOverlayFromRoots(m, "1020094", "1.2.94", []string{root})
	if m["a"] != "b" {
		t.Fatalf("malformed overlay must not touch the map: %+v", m)
	}
}

func TestApplyCssMapOverlayInvalidVersion(t *testing.T) {
	m := map[string]string{"a": "b"}
	applyCssMapOverlay(m, "not-a-version")
	if m["a"] != "b" {
		t.Fatalf("invalid version must be a no-op: %+v", m)
	}
}
