package cmd

import (
	"github.com/spicetify/cli/src/utils"
)

// SupportFeedURL returns the published feed URL, allowing an override via the
// support_feed_url config key (for a mirror or tests).
func SupportFeedURL() string {
	if settingSection != nil {
		if u := settingSection.Key("support_feed_url").MustString(""); u != "" {
			return u
		}
	}
	return utils.DefaultSupportFeedURL
}

// effectiveUpdateBlock decides whether the Spotify binary should have updates
// blocked, given the policy, the published feed (and whether it loaded), and
// the current on-disk block state. Pure: every input is an argument, so the
// gate's core is table-testable without touching a real binary or the network.
//
// The gate rule is one comparison: block while a newer-than-supported Spotify
// exists (latest > supported), unblock once support catches up. When the feed
// is unavailable it preserves the current state rather than risk either an
// unsupported update slipping through or spuriously freezing a healthy client.
func effectiveUpdateBlock(policy UpdatePolicy, feed utils.SupportFeed, feedOK, currentlyBlocked bool) (bool, string) {
	switch policy {
	case UpdatePolicyAllow:
		return false, "update_policy=allow: Spotify updates permitted"
	case UpdatePolicyBlock:
		return true, "update_policy=block: Spotify updates pinned to the current version"
	default: // gate
		preserve := func() (bool, string) {
			state := "unblocked"
			if currentlyBlocked {
				state = "blocked"
			}
			return currentlyBlocked, "update_policy=gate: support feed unavailable, preserving current state (" + state + ")"
		}
		if !feedOK || feed.LatestSpotify == "" || feed.SupportedSpotify == "" {
			return preserve()
		}
		cmp, err := utils.CompareSpotifyVersion(feed.LatestSpotify, feed.SupportedSpotify)
		if err != nil {
			return preserve()
		}
		if cmp > 0 {
			return true, "update_policy=gate: newest Spotify " + feed.LatestSpotify + " is not yet supported (latest verified: " + feed.SupportedSpotify + ")"
		}
		return false, "update_policy=gate: newest Spotify " + feed.LatestSpotify + " is supported"
	}
}

// ResolveUpdateBlock computes the effective block for the live environment: it
// reads the policy, and for gate fetches the feed (failing safe on error) and
// reads the current binary state, returning the decision plus a reason to log.
func ResolveUpdateBlock() (bool, string) {
	policy := EffectiveUpdatePolicy()
	if policy == UpdatePolicyBlock || policy == UpdatePolicyAllow {
		return effectiveUpdateBlock(policy, utils.SupportFeed{}, false, false)
	}
	feed, err := utils.FetchSupportFeed(SupportFeedURL())
	feedOK := err == nil
	currentlyBlocked, cbErr := IsUpdateBlocked()
	if cbErr != nil {
		// Current state unreadable: treat as unblocked. The block primitive
		// re-asserts whatever we return, so this stays consistent.
		currentlyBlocked = false
	}
	return effectiveUpdateBlock(policy, feed, feedOK, currentlyBlocked)
}
