package utils

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSupportListIsSupported(t *testing.T) {
	list := &SupportList{
		SchemaVersion: 1,
		Policy:        "allowlist",
		Versions:      []string{"1.2.93"},
		Ranges: []SupportRange{
			{Min: "1.2.86", Max: "1.2.92"},
		},
	}

	cases := map[string]bool{
		"1.2.93":        true,
		"1.2.93.1.gabc": true,
		"1.2.86":        true,
		"1.2.92":        true,
		"1.2.90":        true,
		"1.2.85":        false,
		"1.2.94":        false,
		"":              false,
		"nope":          false,
	}

	for raw, want := range cases {
		normalized := raw
		if raw != "" && raw != "nope" {
			var err error
			normalized, err = NormalizeSpotifyVersion(raw)
			if err != nil {
				if want {
					t.Fatalf("unexpected normalize error for %q: %v", raw, err)
				}
				if list.IsSupported(raw) {
					t.Fatalf("IsSupported(%q) = true, want false", raw)
				}
				continue
			}
		}
		if got := list.IsSupported(normalized); got != want {
			t.Fatalf("IsSupported(%q) = %v, want %v", raw, got, want)
		}
	}
}

func TestLoadSupportedVersions(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "supported-versions.json")
	content := `{
  "schema_version": 1,
  "policy": "allowlist",
  "versions": ["1.2.93"],
  "ranges": [{"min": "1.2.86", "max": "1.2.92"}]
}`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	list, err := LoadSupportedVersions(path)
	if err != nil {
		t.Fatalf("LoadSupportedVersions: %v", err)
	}
	if !list.IsSupported("1.2.90") || !list.IsSupported("1.2.93") {
		t.Fatalf("loaded list missing expected support")
	}
	if list.IsSupported("1.2.85") {
		t.Fatalf("loaded list should not support 1.2.85")
	}

	summary := list.SupportedSummary()
	if summary == "" || summary == "(none)" {
		t.Fatalf("unexpected summary %q", summary)
	}
}

func TestLoadSupportedVersionsRejectsBadRange(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "supported-versions.json")
	content := `{
  "schema_version": 1,
  "policy": "allowlist",
  "versions": [],
  "ranges": [{"min": "1.2.93", "max": "1.2.86"}]
}`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadSupportedVersions(path); err == nil {
		t.Fatal("expected error for inverted range")
	}
}

func TestLoadSupportedVersionsMissingFile(t *testing.T) {
	if _, err := LoadSupportedVersions(filepath.Join(t.TempDir(), "nope.json")); err == nil {
		t.Fatal("expected error for missing file")
	}
}

func TestShippedSupportedVersionsJSON(t *testing.T) {
	// When tests run from package dir, walk up to module root.
	candidates := []string{
		"supported-versions.json",
		filepath.Join("..", "..", "supported-versions.json"),
	}
	var path string
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			path = c
			break
		}
	}
	if path == "" {
		t.Skip("supported-versions.json not found relative to test cwd")
	}
	list, err := LoadSupportedVersions(path)
	if err != nil {
		t.Fatalf("shipped supported-versions.json invalid: %v", err)
	}
	if !list.IsSupported("1.2.93") || !list.IsSupported("1.2.86") {
		t.Fatalf("seed range should include 1.2.86–1.2.93")
	}
	if list.IsSupported("1.2.85") || list.IsSupported("1.2.94") {
		t.Fatalf("seed range edges incorrect")
	}
}
