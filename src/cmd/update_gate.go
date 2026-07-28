package cmd

import (
	"time"

	"github.com/spicetify/cli/src/utils"
)

// maxFeedAge is how old a support feed may be before the gate distrusts it
// (see utils.FeedIsFresh). Generous enough not to trip on normal maintenance,
// tight enough to catch an abandoned or broken feed.
const maxFeedAge = 30 * 24 * time.Hour

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
// the manifest so the in-client manager can display it. StateUnknown is set
// when neither a fresh feed nor the current binary state is available, in
// which case callers must leave the binary untouched rather than assert a
// guessed direction.
type UpdateGateResult struct {
	Block            bool
	StateUnknown     bool
	Reason           string
	Policy           UpdatePolicy
	LatestSpotify    string
	SupportedSpotify string
}

// resolveUpdateGateFor computes the gate for an explicit policy. Kept separate
// from config so a CLI toggle asserts from the requested policy directly even
// when persistence is skipped.
func resolveUpdateGateFor(policy UpdatePolicy) UpdateGateResult {
	if policy == UpdatePolicyBlock || policy == UpdatePolicyAllow {
		block, reason := effectiveUpdateBlock(policy, utils.SupportFeed{}, false, false)
		return UpdateGateResult{Block: block, Reason: reason, Policy: policy}
	}
	feed, err := utils.FetchSupportFeed(SupportFeedURL())
	// A stale feed is treated as unavailable: its "latest" may lag a newer
	// unsupported build, and trusting it could unblock straight into the break.
	feedOK := err == nil && utils.FeedIsFresh(feed.UpdatedAt, time.Now(), maxFeedAge)
	currentlyBlocked, cbErr := IsUpdateBlocked()
	if cbErr != nil && !feedOK {
		// Double failure: no fresh feed to decide from and no readable current
		// state to preserve. Leave the binary untouched rather than guess.
		return UpdateGateResult{
			StateUnknown: true,
			Policy:       policy,
			Reason:       "update_policy=gate: support feed and current block state both unavailable, leaving the update-block untouched",
		}
	}
	if cbErr != nil {
		currentlyBlocked = false // feed is usable, so preserve() never fires
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

// ResolveUpdateGate computes the effective gate for the live config.
func ResolveUpdateGate() UpdateGateResult {
	return resolveUpdateGateFor(EffectiveUpdatePolicy())
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
	gate := resolveUpdateGateFor(policy)
	utils.PrintInfo(gate.Reason)
	if !gate.StateUnknown {
		BlockSpotifyUpdates(gate.Block)
	}
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
	if gate.StateUnknown {
		blocked = "unknown"
	}
	utils.PrintInfo("updates blocked: " + blocked)
	utils.PrintInfo(gate.Reason)
}
