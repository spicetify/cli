package cmd

import (
	"github.com/spicetify/cli/src/utils"
)

// PrintV3Notice tells the user a v3 preview exists and what switching costs
// them. It prints nothing until a v3 release is actually published, so this
// can ship before one exists, and nothing when GitHub is unreachable.
//
// Restoring first is not optional advice: v3 renames xpui.spa to
// xpui.spa.backup in place, while this CLI consumes xpui.spa. Installing v3
// over a patched client leaves it unbootable, and the damage shows up long
// after the step that caused it.
func PrintV3Notice() {
	tag, err := utils.FetchLatestV3Tag()
	if err != nil || tag == "" {
		return
	}

	utils.PrintInfo("Spicetify " + tag + " (v3 preview) is available.")
	utils.PrintInfo("v3 is a rewrite: your extensions, custom apps and themes are NOT carried over.")
	utils.PrintInfo("Modules replace them. See what exists: https://github.com/spicetify/modules")
	utils.PrintInfo("")
	utils.PrintInfo("If you try it, restore this install FIRST or the client will break:")
	utils.PrintInfo("  spicetify restore")
	utils.PrintInfo("  curl -fsSL https://raw.githubusercontent.com/spicetify/cli/main/install.sh | sh -s -- --v3")
	utils.PrintInfo("")
	utils.PrintInfo("Staying on v2 is fine; it keeps working and this notice is only informational.")
}
