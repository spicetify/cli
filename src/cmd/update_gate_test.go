package cmd

import (
	"testing"

	"github.com/spicetify/cli/src/utils"
)

// effectiveUpdateBlock is the gate's correctness heart: given the policy, the
// published feed, and the current on-disk block state, decide whether the
// binary should be blocked. Table-tested because every branch matters for a
// feature that patches the user's Spotify.
func TestEffectiveUpdateBlock(t *testing.T) {
	feed := func(latest, supported string) utils.SupportFeed {
		return utils.SupportFeed{LatestSpotify: latest, SupportedSpotify: supported}
	}
	cases := []struct {
		name             string
		policy           UpdatePolicy
		feed             utils.SupportFeed
		feedOK           bool
		currentlyBlocked bool
		wantBlock        bool
	}{
		{"gate: newer unsupported version -> block", UpdatePolicyGate, feed("1.2.95.100", "1.2.94.583"), true, false, true},
		{"gate: latest is supported -> unblock", UpdatePolicyGate, feed("1.2.94.583", "1.2.94.583"), true, true, false},
		{"gate: supported ahead of latest -> unblock", UpdatePolicyGate, feed("1.2.93.0", "1.2.94.583"), true, true, false},
		{"gate: feed down, currently blocked -> preserve blocked", UpdatePolicyGate, utils.SupportFeed{}, false, true, true},
		{"gate: feed down, currently unblocked -> preserve unblocked", UpdatePolicyGate, utils.SupportFeed{}, false, false, false},
		{"gate: empty fields treated as unavailable -> preserve", UpdatePolicyGate, feed("", ""), true, true, true},
		{"gate: unparseable versions -> preserve", UpdatePolicyGate, feed("not-a-version", "also-bad"), true, false, false},
		{"block: always blocks regardless of feed", UpdatePolicyBlock, feed("1.2.94.583", "1.2.94.583"), true, false, true},
		{"allow: never blocks regardless of feed", UpdatePolicyAllow, feed("1.2.95.100", "1.2.94.583"), true, true, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			block, reason := effectiveUpdateBlock(tc.policy, tc.feed, tc.feedOK, tc.currentlyBlocked)
			if block != tc.wantBlock {
				t.Fatalf("effectiveUpdateBlock() block = %v, want %v (reason: %s)", block, tc.wantBlock, reason)
			}
			if reason == "" {
				t.Fatal("effectiveUpdateBlock() must return a non-empty reason")
			}
		})
	}
}
