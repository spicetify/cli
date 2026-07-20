package cmd

import (
	"os"

	"github.com/spicetify/cli/src/utils"
)

// forceUnsupportedSpotify allows backup/apply when the installed Spotify
// version is outside the shipped support list.
var forceUnsupportedSpotify bool

// SetForceUnsupportedSpotify enables the one-shot CLI override.
func SetForceUnsupportedSpotify(force bool) {
	forceUnsupportedSpotify = force
}

// RequireSupportedSpotify exits if the installed Spotify version is not in
// supported-versions.json, unless the user opted out via flag or config.
// prefsPath must already be resolved (InitPaths).
func RequireSupportedSpotify() {
	raw := utils.GetSpotifyVersion(prefsPath)

	if forceUnsupportedSpotify {
		utils.PrintWarning("Skipping Spotify version support check (--force-unsupported-spotify). The client may break.")
		return
	}

	if settingSection != nil && !settingSection.Key("spotify_version_check").MustBool(true) {
		utils.PrintWarning("Skipping Spotify version support check (spotify_version_check=0). The client may break.")
		return
	}

	if raw == "" {
		utils.PrintError("Cannot read Spotify version from prefs. Is prefs_path correct and has Spotify been launched at least once?")
		utils.PrintInfo("Set prefs_path in config-xpui.ini, or launch Spotify once, then retry.")
		os.Exit(1)
	}

	normalized, err := utils.NormalizeSpotifyVersion(raw)
	if err != nil {
		utils.PrintError("Cannot parse Spotify version " + raw + ": " + err.Error())
		os.Exit(1)
	}

	listPath := utils.DefaultSupportedVersionsPath()
	list, err := utils.LoadSupportedVersions(listPath)
	if err != nil {
		utils.PrintError(err.Error())
		utils.PrintInfo("Reinstall Spicetify so supported-versions.json is next to the spicetify binary.")
		os.Exit(1)
	}

	if list.IsSupported(normalized) {
		return
	}

	classmapKey, keyErr := utils.SpotifyVersionToClassmapKey(normalized)
	utils.PrintError("Spotify " + raw + " (" + normalized + ") is not supported by this Spicetify release.")
	utils.PrintInfo("Supported versions: " + list.SupportedSummary())
	if keyErr == nil {
		utils.PrintInfo("Classmap key for this version would be: " + classmapKey)
	}
	utils.PrintInfo("Install a supported Spotify build, or upgrade Spicetify when support is added.")
	utils.PrintInfo("To override (may break the client): --force-unsupported-spotify")
	utils.PrintInfo("Or set spotify_version_check=0 in config-xpui.ini")
	os.Exit(1)
}
