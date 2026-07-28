package utils

import (
	"os"
	"path/filepath"
	"testing"
)

func fixtureClassmapPath(t *testing.T) string {
	t.Helper()
	candidates := []string{
		filepath.Join("testdata", "classmaps", "1020045", "classmap.json"),
		filepath.Join("src", "utils", "testdata", "classmaps", "1020045", "classmap.json"),
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	t.Fatal("fixture classmap not found")
	return ""
}

func TestLoadAndValidateClassmapFixture(t *testing.T) {
	path := fixtureClassmapPath(t)
	cm, err := LoadClassmap(path)
	if err != nil {
		t.Fatalf("LoadClassmap: %v", err)
	}
	if cm.LeafCount() < 10 {
		t.Fatalf("expected fixture to have many leaves, got %d", cm.LeafCount())
	}

	got, err := cm.Resolve("main.topbar.wrapper")
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if got == "" {
		t.Fatal("empty class name")
	}

	if _, err := cm.Resolve("main.does.not.exist"); err == nil {
		t.Fatal("expected missing path error")
	}
}

func TestValidateClassmapRejectsBadShapes(t *testing.T) {
	cases := []Classmap{
		{},
		{"a": ""},
		{"a": 1},
		{"a": nil},
	}
	for i, cm := range cases {
		if err := cm.Validate(); err == nil {
			t.Fatalf("case %d: expected validation error", i)
		}
	}

	// Empty nested objects are structural placeholders and are allowed.
	withStub := Classmap{"main": map[string]any{"todo": map[string]any{}, "wrapper": "abc123HashValue"}}
	if err := withStub.Validate(); err != nil {
		t.Fatalf("classmap with empty nested object rejected: %v", err)
	}

	ok := Classmap{"main": map[string]any{"wrapper": "abc123HashValue"}}
	if err := ok.Validate(); err != nil {
		t.Fatalf("valid classmap rejected: %v", err)
	}
}

func TestFindClassmapFile(t *testing.T) {
	path := fixtureClassmapPath(t)
	cm, err := LoadClassmap(path)
	if err != nil {
		t.Fatal(err)
	}
	play, err := cm.Resolve("main.playbar.controls.buttons.play")
	if err != nil {
		t.Fatalf("play button: %v", err)
	}
	if play == "" {
		t.Fatal("empty play class")
	}
}

func TestFindClassmapFileInPrecedence(t *testing.T) {
	// Two roots both containing key 1020093. Root order must win over
	// file-name sorting: binary dir (first root) beats config dir even
	// when the config dir has a lexicographically larger glob name.
	binRoot := t.TempDir()
	cfgRoot := t.TempDir()

	write := func(root, name, content string) string {
		t.Helper()
		dir := filepath.Join(root, "1020093")
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
		p := filepath.Join(dir, name)
		if err := os.WriteFile(p, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
		return p
	}

	binFile := write(binRoot, "classmap.json", `{"a":"fromBinRoot"}`)
	write(cfgRoot, "classmap-zzz.json", `{"a":"fromCfgRoot"}`)

	got, err := FindClassmapFileIn("1020093", []string{binRoot, cfgRoot})
	if err != nil {
		t.Fatalf("FindClassmapFileIn: %v", err)
	}
	if got != binFile {
		t.Fatalf("first root must win: got %q, want %q", got, binFile)
	}

	// Falls through to the second root when the first has no match.
	got, err = FindClassmapFileIn("1020093", []string{filepath.Join(binRoot, "empty"), cfgRoot})
	if err != nil {
		t.Fatalf("FindClassmapFileIn fallback: %v", err)
	}
	want := filepath.Join(cfgRoot, "1020093", "classmap-zzz.json")
	if got != want {
		t.Fatalf("fallback root: got %q, want %q", got, want)
	}
}

func TestFindClassmapFileInWithinRoot(t *testing.T) {
	// Within one root, plain classmap.json is preferred; otherwise the
	// lexicographically last classmap-*.json wins.
	root := t.TempDir()
	dir := filepath.Join(root, "1020045")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	write := func(name string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, name), []byte(`{"a":"x"}`), 0600); err != nil {
			t.Fatal(err)
		}
	}

	write("classmap-aaa.json")
	write("classmap-bbb.json")

	got, err := FindClassmapFileIn("1020045", []string{root})
	if err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(dir, "classmap-bbb.json"); got != want {
		t.Fatalf("glob last wins: got %q, want %q", got, want)
	}

	write("classmap.json")
	got, err = FindClassmapFileIn("1020045", []string{root})
	if err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(dir, "classmap.json"); got != want {
		t.Fatalf("classmap.json preferred: got %q, want %q", got, want)
	}

	if _, err := FindClassmapFileIn("9999999", []string{root}); err == nil {
		t.Fatal("expected error for missing key")
	}
	if _, err := FindClassmapFileIn("", []string{root}); err == nil {
		t.Fatal("expected error for empty key")
	}
}

func TestValidateClassmapStatus(t *testing.T) {
	if err := ValidateClassmapStatus(ClassmapStatusClassic); err != nil {
		t.Fatal(err)
	}
	if err := ValidateClassmapStatus("nope"); err == nil {
		t.Fatal("expected error")
	}
}

func TestFindCssMapOverlayIn(t *testing.T) {
	binRoot := t.TempDir()
	cfgRoot := t.TempDir()

	write := func(root, name string) string {
		t.Helper()
		dir := filepath.Join(root, "1020092")
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
		p := filepath.Join(dir, name)
		if err := os.WriteFile(p, []byte(`{"abcHash123":"x-settings-section"}`), 0600); err != nil {
			t.Fatal(err)
		}
		return p
	}

	write(cfgRoot, "css-map.json")
	got, err := FindCssMapOverlayIn("1020092", []string{binRoot, cfgRoot})
	if err != nil {
		t.Fatalf("FindCssMapOverlayIn: %v", err)
	}
	if want := filepath.Join(cfgRoot, "1020092", "css-map.json"); got != want {
		t.Fatalf("got %q, want %q", got, want)
	}

	// First root wins when both have an overlay.
	binFile := write(binRoot, "css-map.json")
	got, err = FindCssMapOverlayIn("1020092", []string{binRoot, cfgRoot})
	if err != nil {
		t.Fatal(err)
	}
	if got != binFile {
		t.Fatalf("first root must win: got %q, want %q", got, binFile)
	}

	if _, err := FindCssMapOverlayIn("9999999", []string{binRoot}); err == nil {
		t.Fatal("expected error for missing overlay")
	}
}

func TestLoadCssMapOverlay(t *testing.T) {
	dir := t.TempDir()

	ok := filepath.Join(dir, "ok.json")
	if err := os.WriteFile(ok, []byte(`{"abcHash123":"x-settings-section"}`), 0600); err != nil {
		t.Fatal(err)
	}
	overlay, err := LoadCssMapOverlay(ok)
	if err != nil {
		t.Fatalf("LoadCssMapOverlay: %v", err)
	}
	if overlay["abcHash123"] != "x-settings-section" {
		t.Fatalf("unexpected overlay: %+v", overlay)
	}

	nested := filepath.Join(dir, "nested.json")
	if err := os.WriteFile(nested, []byte(`{"a":{"b":"c"}}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadCssMapOverlay(nested); err == nil {
		t.Fatal("expected error for nested (classmap-shaped) overlay")
	}

	if _, err := LoadCssMapOverlay(filepath.Join(dir, "missing.json")); err == nil {
		t.Fatal("expected error for missing file")
	}
}

func TestLoadCssMapOverlayRejectsEmptyEntries(t *testing.T) {
	dir := t.TempDir()
	cases := map[string]string{
		"empty key":   `{"":"x-settings-section"}`,
		"empty value": `{"abcHash123":""}`,
		"blank value": `{"abcHash123":"  "}`,
	}
	for name, content := range cases {
		p := filepath.Join(dir, "bad.json")
		if err := os.WriteFile(p, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := LoadCssMapOverlay(p); err == nil {
			t.Fatalf("%s: expected error", name)
		}
	}
}

func TestResolveClassmapKeyIn(t *testing.T) {
	root := t.TempDir()
	mk := func(key string) {
		dir := filepath.Join(root, key)
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "classmap.json"), []byte("{}"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	mk("1020092") // 1.2.92
	mk("1020094") // 1.2.94
	mk("1010040") // 1.1.40 - different minor, must never be a fallback for 1.2.x
	roots := []string{root}

	cases := []struct {
		name    string
		req     string
		wantKey string
		wantFB  bool
		wantErr bool
	}{
		{"exact match wins", "1020094", "1020094", false, false},
		{"patch fallback to nearest lower", "1020095", "1020094", true, false},
		{"nearest-lower skips a higher key", "1020093", "1020092", true, false},
		{"no fallback across a new minor", "1030000", "", false, true},
		{"no fallback below everything in the minor", "1020010", "", false, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			key, fb, err := ResolveClassmapKeyIn(tc.req, roots)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got key=%q fb=%v", key, fb)
				}
				return
			}
			if err != nil || key != tc.wantKey || fb != tc.wantFB {
				t.Fatalf("got key=%q fb=%v err=%v; want key=%q fb=%v", key, fb, err, tc.wantKey, tc.wantFB)
			}
		})
	}
}
