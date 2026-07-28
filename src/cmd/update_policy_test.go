package cmd

import "testing"

// resolveUpdatePolicy is the correctness heart of how config maps to the
// three policies, including the back-compat bridge from block_spotify_updates.
func TestResolveUpdatePolicy(t *testing.T) {
	cases := []struct {
		name        string
		raw         string
		legacyBlock bool
		want        UpdatePolicy
	}{
		{"default unset, no legacy", "", false, UpdatePolicyGate},
		{"explicit gate", "gate", false, UpdatePolicyGate},
		{"explicit block", "block", false, UpdatePolicyBlock},
		{"explicit allow", "allow", false, UpdatePolicyAllow},
		{"legacy block honored when unset", "", true, UpdatePolicyBlock},
		{"explicit wins over legacy (allow beats block=1)", "allow", true, UpdatePolicyAllow},
		{"explicit gate wins over legacy block", "gate", true, UpdatePolicyGate},
		{"unknown value degrades to gate", "freeze", false, UpdatePolicyGate},
		{"case-insensitive and trimmed", "  BLOCK ", false, UpdatePolicyBlock},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := resolveUpdatePolicy(tc.raw, tc.legacyBlock); got != tc.want {
				t.Fatalf("resolveUpdatePolicy(%q, %v) = %q, want %q", tc.raw, tc.legacyBlock, got, tc.want)
			}
		})
	}
}
