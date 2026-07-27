package cmd

import (
	"bytes"
	"testing"
)

// The endpoint patch is the one piece of update-blocking that is identical
// on every platform, so testing it here gives cross-platform confidence
// without a real Spotify binary on Windows/macOS/Linux.
func TestPatchUpdateEndpoint(t *testing.T) {
	const base = "\x00\x00binary desktop-update/v2/update more bytes\x00"

	blocked, changed := patchUpdateEndpoint([]byte(base), true)
	if !changed {
		t.Fatal("block should report a change on a live binary")
	}
	if !bytes.Contains(blocked, []byte(updateEndpointBlocked)) || bytes.Contains(blocked, []byte(updateEndpointLive)) {
		t.Fatalf("block did not neuter the endpoint: %q", blocked)
	}
	if len(blocked) != len(base) {
		t.Fatalf("patch must be length-preserving: got %d want %d", len(blocked), len(base))
	}

	// Idempotent: blocking again finds no live endpoint to change.
	if _, changed := patchUpdateEndpoint(blocked, true); changed {
		t.Fatal("blocking an already-blocked binary should be a no-op")
	}

	// Reversible: unblock restores the exact original bytes.
	restored, changed := patchUpdateEndpoint(blocked, false)
	if !changed {
		t.Fatal("unblock should report a change on a blocked binary")
	}
	if string(restored) != base {
		t.Fatalf("unblock did not restore the original: %q", restored)
	}

	// Idempotent the other way too.
	if _, changed := patchUpdateEndpoint(restored, false); changed {
		t.Fatal("unblocking an already-live binary should be a no-op")
	}

	// No endpoint present: nothing to do, no accidental writes.
	if out, changed := patchUpdateEndpoint([]byte("no endpoint here"), true); changed || string(out) != "no endpoint here" {
		t.Fatalf("missing endpoint must be left untouched, got changed=%v %q", changed, out)
	}
}
