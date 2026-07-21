package utils

import (
	"strings"
	"testing"
)

func testClassmap(t *testing.T) Classmap {
	t.Helper()
	return Classmap{
		"main": map[string]any{
			"topbar": map[string]any{
				"wrapper": "hashTopbar1",
			},
			"playbar": map[string]any{
				"buttons": map[string]any{
					"button": map[string]any{
						"wrapper":          "hashPlayBtn",
						"wrapper__active":  "hashPlayBtnActive",
						"wrapper__compact": "hashPlayBtnCompact",
					},
				},
			},
		},
		"settings": map[string]any{
			"button": map[string]any{"wrapper": "hashSettingsBtn"},
		},
	}
}

func TestRemapClassmapReferences(t *testing.T) {
	cm := testClassmap(t)

	src := `// mimics spicetify/modules stdlib usage
const btn = <button className={MAP.settings.button.wrapper} />;
const cls = classnames(MAP.main.playbar.buttons.button.wrapper, {
  [MAP.main.playbar.buttons.button.wrapper__active]: active,
});
const sel = ` + "`" + `.${MAP.main.topbar.wrapper} .${MAP.settings.button.wrapper}` + "`" + `
`
	out, err := RemapClassmapReferences(src, cm)
	if err != nil {
		t.Fatalf("RemapClassmapReferences: %v", err)
	}

	for _, want := range []string{
		`className={"hashSettingsBtn"}`,
		`classnames("hashPlayBtn"`,
		`["hashPlayBtnActive"]: active`,
		`.${"hashTopbar1"} .${"hashSettingsBtn"}`,
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("output missing %q:\n%s", want, out)
		}
	}
}

func TestRemapClassmapReferencesSuffixKeys(t *testing.T) {
	cm := testClassmap(t)
	out, err := RemapClassmapReferences(`const x = MAP.main.playbar.buttons.button.wrapper__compact;`, cm)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, `"hashPlayBtnCompact"`) {
		t.Fatalf("suffix key not resolved: %s", out)
	}
}

func TestRemapClassmapReferencesUnresolved(t *testing.T) {
	cm := testClassmap(t)
	src := `const a = MAP.main.does.not.exist;
const b = MAP.main.topbar;`
	if _, err := RemapClassmapReferences(src, cm); err == nil {
		t.Fatal("expected error for unresolved references")
	} else {
		if !strings.Contains(err.Error(), "main.does.not.exist") {
			t.Fatalf("error should name the unresolved path: %v", err)
		}
		if !strings.Contains(err.Error(), "main.topbar") {
			t.Fatalf("non-leaf path should be reported: %v", err)
		}
	}
}

func TestRemapClassmapReferencesNoFalsePositives(t *testing.T) {
	cm := testClassmap(t)
	src := `const ROADMAP = { x: 1 };
const MAPX = MAP;
const y = ROADMAP.x;`
	out, err := RemapClassmapReferences(src, cm)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "ROADMAP") || !strings.Contains(out, "MAPX") {
		t.Fatalf("unrelated identifiers were rewritten:\n%s", out)
	}
}

func TestRemapClassmapReferencesStale(t *testing.T) {
	cm := testClassmap(t)
	opts := RemapOptions{StalePaths: map[string]bool{
		"settings.button.wrapper": true,
	}}

	if _, err := RemapClassmapReferencesWithOptions(`const a = MAP.settings.button.wrapper;`, cm, opts); err == nil {
		t.Fatal("expected error for stale reference")
	} else if !strings.Contains(err.Error(), "stale: settings.button.wrapper") {
		t.Fatalf("error should mark the path as stale: %v", err)
	}

	out, err := RemapClassmapReferencesWithOptions(`const a = MAP.main.topbar.wrapper;`, cm, opts)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, `"hashTopbar1"`) {
		t.Fatalf("non-stale reference should still resolve: %s", out)
	}
}

func TestRetargetClassmapHashes(t *testing.T) {
	from := Classmap{"main": map[string]any{
		"topbar":  map[string]any{"wrapper": "oldTop1"},
		"playbar": map[string]any{"buttons": map[string]any{"play": "oldPlay1"}},
	}}
	to := Classmap{"main": map[string]any{
		"topbar":  map[string]any{"wrapper": "newTop1"},
		"playbar": map[string]any{"buttons": map[string]any{"play": "newPlay1"}},
	}}

	src := `const a = "oldTop1"; el.className = "oldPlay1"; const keep = "unrelated";`
	out, err := RetargetClassmapHashes(src, from, to, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, `"newTop1"`) || !strings.Contains(out, `"newPlay1"`) {
		t.Fatalf("hashes not retargeted:\n%s", out)
	}
	if !strings.Contains(out, `"unrelated"`) {
		t.Fatalf("unrelated string touched:\n%s", out)
	}
}

func TestRetargetClassmapHashesMissing(t *testing.T) {
	from := Classmap{"a": map[string]any{"b": "oldB1"}}
	to := Classmap{"a": map[string]any{"c": "newC1"}}
	if _, err := RetargetClassmapHashes(`const x = "oldB1";`, from, to, nil); err == nil {
		t.Fatal("expected error for path missing in target")
	}
}

func TestRetargetClassmapHashesStale(t *testing.T) {
	from := Classmap{"a": map[string]any{"b": "oldB1"}}
	to := Classmap{"a": map[string]any{"b": "newB1"}}
	_, err := RetargetClassmapHashes(`const x = "oldB1";`, from, to, map[string]bool{"a.b": true})
	if err == nil || !strings.Contains(err.Error(), "stale: a.b") {
		t.Fatalf("expected stale error, got %v", err)
	}
}

func TestRetargetClassmapHashesNoOverlap(t *testing.T) {
	from := Classmap{
		"a": map[string]any{"x": "abc"},
		"b": map[string]any{"y": "abcdef"},
	}
	to := Classmap{
		"a": map[string]any{"x": "X1"},
		"b": map[string]any{"y": "Y1"},
	}
	out, err := RetargetClassmapHashes(`"abcdef" "abc"`, from, to, nil)
	if err != nil {
		t.Fatal(err)
	}
	if out != `"Y1" "X1"` {
		t.Fatalf("overlap mishandled: %s", out)
	}
}
