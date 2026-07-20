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
