package cmd

import (
	"strings"

	"github.com/spicetify/cli/src/utils"
)

// UpdatePolicy controls how Spotify self-updates are handled.
//
//	gate  - feed-aware: hold the user on their current version while the
//	        newest available Spotify is unsupported, auto-unblock once a
//	        verified classmap ships (the default).
//	block - always freeze on the current version (legacy behavior).
//	allow - never block; let Spotify update freely.
type UpdatePolicy string

const (
	UpdatePolicyGate  UpdatePolicy = "gate"
	UpdatePolicyBlock UpdatePolicy = "block"
	UpdatePolicyAllow UpdatePolicy = "allow"
)

// resolveUpdatePolicy is the pure resolution of the effective policy from the
// raw update_policy value and the legacy block_spotify_updates bool.
//
// Precedence: an explicit update_policy wins. When update_policy is unset we
// fall back to the legacy bool (block_spotify_updates=1 -> block) so existing
// users who opted into a freeze keep it; otherwise the default is gate. An
// unrecognized value degrades to gate rather than erroring.
func resolveUpdatePolicy(raw string, legacyBlock bool) UpdatePolicy {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "gate":
		return UpdatePolicyGate
	case "block":
		return UpdatePolicyBlock
	case "allow":
		return UpdatePolicyAllow
	case "":
		if legacyBlock {
			return UpdatePolicyBlock
		}
		return UpdatePolicyGate
	default:
		return UpdatePolicyGate
	}
}

// EffectiveUpdatePolicy reads the resolved policy from live config. It warns
// once on an unrecognized update_policy value so a typo is visible without
// being fatal.
func EffectiveUpdatePolicy() UpdatePolicy {
	if settingSection == nil {
		return UpdatePolicyGate
	}
	raw := settingSection.Key("update_policy").MustString("")
	legacyBlock := settingSection.Key("block_spotify_updates").MustBool(false)
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	if trimmed != "" && trimmed != "gate" && trimmed != "block" && trimmed != "allow" {
		utils.PrintWarning("Unknown update_policy \"" + raw + "\"; falling back to gate. Valid values: gate, block, allow.")
	}
	return resolveUpdatePolicy(raw, legacyBlock)
}
