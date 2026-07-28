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

// UpdateGateResult is the resolved gate decision plus the context that rides
// the manifest so the in-client manager can display it.
type UpdateGateResult struct {
	Block            bool
	Reason           string
	Policy           UpdatePolicy
	LatestSpotify    string
	SupportedSpotify string
}

// ResolveUpdateGate computes the effective gate for the live environment: it
// reads the policy, and for gate fetches the feed (failing safe on error) and
// reads the current binary state.
func ResolveUpdateGate() UpdateGateResult {
	policy := EffectiveUpdatePolicy()
	if policy == UpdatePolicyBlock || policy == UpdatePolicyAllow {
		block, reason := effectiveUpdateBlock(policy, utils.SupportFeed{}, false, false)
		return UpdateGateResult{Block: block, Reason: reason, Policy: policy}
	}
	feed, err := utils.FetchSupportFeed(SupportFeedURL())
	feedOK := err == nil
	currentlyBlocked, cbErr := IsUpdateBlocked()
	if cbErr != nil {
		// Current state unreadable: treat as unblocked. The block primitive
		// re-asserts whatever we return, so this stays consistent.
		currentlyBlocked = false
	}
	block, reason := effectiveUpdateBlock(policy, feed, feedOK, currentlyBlocked)
	return UpdateGateResult{
		Block:            block,
		Reason:           reason,
		Policy:           policy,
		LatestSpotify:    feed.LatestSpotify,
		SupportedSpotify: feed.SupportedSpotify,
	}
}

// SetUpdatePolicy persists the policy to config and asserts the resulting
// block state immediately, so a CLI toggle sticks across future applies
// (otherwise the next apply's gate would re-evaluate and possibly undo it).
func SetUpdatePolicy(policy UpdatePolicy) {
	if settingSection != nil {
		settingSection.Key("update_policy").SetValue(string(policy))
		if err := cfg.Write(); err != nil {
			utils.PrintWarning("Could not persist update_policy: " + err.Error())
		}
	}
	gate := ResolveUpdateGate()
	utils.PrintInfo(gate.Reason)
	BlockSpotifyUpdates(gate.Block)
}

// PrintUpdateGateStatus reports the current gate decision and versions, the
// CLI-side twin of the manager's Updates panel.
func PrintUpdateGateStatus() {
	gate := ResolveUpdateGate()
	utils.PrintInfo("update_policy: " + string(gate.Policy))
	if gate.LatestSpotify != "" {
		utils.PrintInfo("latest Spotify: " + gate.LatestSpotify)
	}
	if gate.SupportedSpotify != "" {
		utils.PrintInfo("latest supported: " + gate.SupportedSpotify)
	}
	blocked := "no"
	if gate.Block {
		blocked = "yes"
	}
	utils.PrintInfo("updates blocked: " + blocked)
	utils.PrintInfo(gate.Reason)
}
