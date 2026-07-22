package utils

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

func writeTestZip(t *testing.T, entries map[string]string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "test.zip")
	out, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer out.Close()
	w := zip.NewWriter(out)
	for name, content := range entries {
		f, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := f.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestUnzipSafeEntries(t *testing.T) {
	zipPath := writeTestZip(t, map[string]string{
		"index.js":       "export {}",
		"lib/helper.css": "body{}",
	})
	dest := t.TempDir()
	if err := Unzip(zipPath, dest); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dest, "index.js")); err != nil {
		t.Fatalf("expected index.js extracted: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dest, "lib", "helper.css")); err != nil {
		t.Fatalf("expected lib/helper.css extracted: %v", err)
	}
}

func TestUnzipRejectsTraversal(t *testing.T) {
	outside := t.TempDir()
	zipPath := writeTestZip(t, map[string]string{
		"../../../escape.js": "pwned",
	})
	dest := t.TempDir()
	if err := Unzip(zipPath, dest); err == nil {
		t.Fatal("expected error for traversal entry")
	}
	if _, err := os.Stat(filepath.Join(outside, "escape.js")); err == nil {
		t.Fatal("traversal entry was written outside the destination")
	}
}
