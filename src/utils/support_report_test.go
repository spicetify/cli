package utils

import (
	"os"
	"path/filepath"
	"testing"
)

func TestEvaluateSpotifySupportWithMaps(t *testing.T) {
	dir := t.TempDir()
	listPath := filepath.Join(dir, "supported-versions.json")
	content := `{
  "schema_version": 2,
  "policy": "allowlist",
  "default_map_status": "classic",
  "versions": ["1.2.93"],
  "ranges": [],
  "maps": {
    "1.2.93": { "status": "classic", "note": "seed" }
  }
}`
	if err := os.WriteFile(listPath, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	report := EvaluateSpotifySupport("1.2.93.9.gabc", listPath)
	if !report.Supported {
		t.Fatalf("expected supported: %+v", report)
	}
	if report.NormalizedVersion != "1.2.93" {
		t.Fatalf("normalized: %q", report.NormalizedVersion)
	}
	if report.Map.ClassmapKey != "1020093" {
		t.Fatalf("classmap key: %q", report.Map.ClassmapKey)
	}
	if report.Map.Status != ClassmapStatusClassic {
		t.Fatalf("status: %q", report.Map.Status)
	}

	// Classmap file absent is fine for classic.
	if report.ClassmapPath != "" {
		t.Fatalf("unexpected classmap path %q", report.ClassmapPath)
	}

	bad := EvaluateSpotifySupport("1.2.10.0", listPath)
	if bad.Supported {
		t.Fatal("1.2.10 should be unsupported")
	}
	if bad.Map.ClassmapKey != "1020010" {
		t.Fatalf("key for unsupported still computed, got %q", bad.Map.ClassmapKey)
	}
}

func TestFindClassmapFileIn(t *testing.T) {
	// Use package testdata as a search root: testdata/classmaps/1020045/classmap.json
	root := filepath.Join("testdata", "classmaps")
	if _, err := os.Stat(filepath.Join(root, "1020045", "classmap.json")); err != nil {
		root = filepath.Join("src", "utils", "testdata", "classmaps")
	}
	// FindClassmapFileIn expects roots that contain <key>/classmap.json
	// so pass parent of key folders.
	parent := root
	path, err := FindClassmapFileIn("1020045", []string{parent})
	if err != nil {
		t.Fatalf("FindClassmapFileIn: %v", err)
	}
	cm, err := LoadClassmap(path)
	if err != nil {
		t.Fatal(err)
	}
	if cm.LeafCount() == 0 {
		t.Fatal("empty classmap")
	}
}

func TestMapInfoForDefaults(t *testing.T) {
	list := &SupportList{
		DefaultMapStatus: ClassmapStatusClassic,
		Versions:         []string{"1.2.90"},
		Maps:             map[string]ClassmapInfo{},
	}
	info, err := list.MapInfoFor("1.2.90")
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != ClassmapStatusClassic || info.ClassmapKey != "1020090" {
		t.Fatalf("unexpected info: %+v", info)
	}
}

func TestEvaluateSpotifySupportListUnavailable(t *testing.T) {
	// Missing list file: report must mark the list as unavailable instead
	// of asserting "not allowlisted" (gate fails open in the same case).
	report := EvaluateSpotifySupport("1.2.93", filepath.Join(t.TempDir(), "missing.json"))
	if report.ListAvailable {
		t.Fatal("ListAvailable = true for missing list")
	}
	if report.Supported {
		t.Fatal("Supported must stay false when the list is unavailable")
	}
	if report.SupportListError == "" {
		t.Fatal("expected SupportListError to explain the missing list")
	}
	if report.Map.ClassmapKey != "1020093" {
		t.Fatalf("classmap key still computed, got %q", report.Map.ClassmapKey)
	}
}
