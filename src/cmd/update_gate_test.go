package cmd

import "testing"

// effectiveUpdateBlock is the gate's correctness heart: given the policy, the
// published feed, and the current on-disk block state, decide whether the
// binary should be blocked. Table-tested because every branch matters for a
// feature that patches the user's Spotify.
func TestEffectiveUpdateBlock(t *testing.T) {
	cases := []struct {
		name             string
		policy           UpdatePolicy
		latest           string
		supported        string
		feedOK           bool
		currentlyBlocked bool
		wantBlock        bool
	}{
		{"gate: newer unsupported version -> block", UpdatePolicyGate, "1.2.95.100", "1.2.94.583", true, false, true},
		{"gate: latest is supported -> unblock", UpdatePolicyGate, "1.2.94.583", "1.2.94.583", true, true, false},
		{"gate: supported ahead of latest -> unblock", UpdatePolicyGate, "1.2.93.0", "1.2.94.583", true, true, false},
		{"gate: unknown state, currently blocked -> preserve blocked", UpdatePolicyGate, "", "", false, true, true},
		{"gate: unknown state, currently unblocked -> preserve unblocked", UpdatePolicyGate, "", "", false, false, false},
		{"gate: empty fields treated as unavailable -> preserve", UpdatePolicyGate, "", "", true, true, true},
		{"gate: unparseable versions -> preserve", UpdatePolicyGate, "not-a-version", "also-bad", true, false, false},
		{"block: always blocks regardless of feed", UpdatePolicyBlock, "1.2.94.583", "1.2.94.583", true, false, true},
		{"allow: never blocks regardless of feed", UpdatePolicyAllow, "1.2.95.100", "1.2.94.583", true, true, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			block, reason := effectiveUpdateBlock(tc.policy, tc.latest, tc.supported, tc.feedOK, tc.currentlyBlocked)
			if block != tc.wantBlock {
				t.Fatalf("effectiveUpdateBlock() block = %v, want %v (reason: %s)", block, tc.wantBlock, reason)
			}
			if reason == "" {
				t.Fatal("effectiveUpdateBlock() must return a non-empty reason")
			}
		})
	}
}
