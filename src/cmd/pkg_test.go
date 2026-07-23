package cmd

import (
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestVerifyChecksum(t *testing.T) {
	dir := t.TempDir()
	zipPath := filepath.Join(dir, "mod.zip")
	if err := os.WriteFile(zipPath, []byte("artifact"), 0600); err != nil {
		t.Fatal(err)
	}
	sum := fmt.Sprintf("sha256:%x", sha256.Sum256([]byte("artifact")))

	if err := verifyChecksum(zipPath, sum); err != nil {
		t.Fatalf("valid checksum rejected: %v", err)
	}
	if err := verifyChecksum(zipPath, "sha256:0000"); err == nil {
		t.Fatal("mismatched checksum accepted")
	}
	if err := verifyChecksum(zipPath, ""); err != nil {
		t.Fatalf("missing checksum should warn and pass, got %v", err)
	}
}
