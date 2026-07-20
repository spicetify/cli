package utils

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
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

func TestSupportListCheckSupported(t *testing.T) {
	list := &SupportList{
		SchemaVersion: 1,
		Policy:        "allowlist",
		Ranges:        []SupportRange{{Min: "1.2.86", Max: "1.2.93"}},
	}

	if err := list.CheckSupported("1.2.90.4.gabc"); err != nil {
		t.Fatalf("CheckSupported(supported) = %v, want nil", err)
	}

	err := list.CheckSupported("1.2.94")
	if err == nil {
		t.Fatal("CheckSupported(unsupported) = nil, want error")
	}
	if !strings.Contains(err.Error(), "1.2.94") {
		t.Fatalf("error should name the version, got %q", err.Error())
	}

	if err := list.CheckSupported("not-a-version"); err == nil {
		t.Fatal("CheckSupported(garbage) = nil, want parse error")
	}

	var nilList *SupportList
	if err := nilList.CheckSupported("1.2.90"); err == nil {
		t.Fatal("CheckSupported on nil list = nil, want error")
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
	if strings.ContainsAny(summary, "–—") {
		t.Fatalf("summary must stay ASCII for Windows codepages, got %q", summary)
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

func TestLoadSupportedVersionsRejectsUnknownSchema(t *testing.T) {
	dir := t.TempDir()
	for _, schema := range []int{0, 3, 99} {
		path := filepath.Join(dir, "list.json")
		content := `{"schema_version": ` + strconv.Itoa(schema) + `, "policy": "allowlist"}`
		if err := os.WriteFile(path, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := LoadSupportedVersions(path); err == nil {
			t.Fatalf("expected error for schema_version %d", schema)
		}
	}
}

func TestFindSupportedVersionsFileIn(t *testing.T) {
	dir := t.TempDir()
	first := filepath.Join(dir, "a", "supported-versions.json")
	second := filepath.Join(dir, "b", "supported-versions.json")
	if err := os.MkdirAll(filepath.Dir(second), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(second, []byte(`{"schema_version": 1}`), 0600); err != nil {
		t.Fatal(err)
	}

	got, err := FindSupportedVersionsFileIn([]string{first, second})
	if err != nil {
		t.Fatalf("FindSupportedVersionsFileIn: %v", err)
	}
	if got != second {
		t.Fatalf("got %q, want %q", got, second)
	}

	if _, err := FindSupportedVersionsFileIn([]string{first}); err == nil {
		t.Fatal("expected error when nothing exists")
	}

	// Order wins when both exist.
	if err := os.MkdirAll(filepath.Dir(first), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(first, []byte(`{"schema_version": 1}`), 0600); err != nil {
		t.Fatal(err)
	}
	got, err = FindSupportedVersionsFileIn([]string{first, second})
	if err != nil {
		t.Fatal(err)
	}
	if got != first {
		t.Fatalf("priority order broken: got %q, want %q", got, first)
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
	// Structural invariants only; do not hardcode window edges, they move
	// every time the allowlist is bumped.
	if len(list.Versions)+len(list.Ranges) == 0 {
		t.Fatal("shipped list must allow at least one version or range")
	}
	if list.SupportedSummary() == "(none listed)" {
		t.Fatal("shipped list summary must not be empty")
	}
}

func TestLoadSupportedVersionsV2(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "supported-versions.json")
	content := `{
  "schema_version": 2,
  "policy": "allowlist",
  "default_map_status": "classic",
  "versions": ["1.2.93"],
  "ranges": [],
  "maps": {
    "1.2.93": { "status": "modular", "note": "verified" }
  }
}`
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	list, err := LoadSupportedVersions(path)
	if err != nil {
		t.Fatalf("LoadSupportedVersions v2: %v", err)
	}
	info, err := list.MapInfoFor("1.2.93.9.gabc")
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != ClassmapStatusModular {
		t.Fatalf("status: %q", info.Status)
	}
	if info.ClassmapKey != "1020093" {
		t.Fatalf("classmap key filled from version: %q", info.ClassmapKey)
	}
}

func TestLoadSupportedVersionsV2Negatives(t *testing.T) {
	dir := t.TempDir()
	cases := map[string]string{
		"invalid default_map_status": `{
  "schema_version": 2,
  "default_map_status": "banana"
}`,
		"invalid maps key": `{
  "schema_version": 2,
  "maps": { "not-a-version": {} }
}`,
		"invalid maps status": `{
  "schema_version": 2,
  "maps": { "1.2.93": { "status": "banana" } }
}`,
		"duplicate normalized maps keys": `{
  "schema_version": 2,
  "maps": { "1.2.93": {}, "v1.2.93": {} }
}`,
	}
	for name, content := range cases {
		path := filepath.Join(dir, "list.json")
		if err := os.WriteFile(path, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := LoadSupportedVersions(path); err == nil {
			t.Fatalf("%s: expected error, got nil", name)
		}
	}
}

func TestSupportedSummarySemverOrder(t *testing.T) {
	list := &SupportList{
		Versions: []string{"1.2.100", "1.2.93"},
		Ranges:   []SupportRange{{Min: "1.2.86", Max: "1.2.92"}},
	}
	got := list.SupportedSummary()
	want := "1.2.86-1.2.92, 1.2.93, 1.2.100"
	if got != want {
		t.Fatalf("SupportedSummary = %q, want %q", got, want)
	}
}
