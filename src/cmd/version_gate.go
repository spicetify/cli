package cmd

import (
	"fmt"
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

// versionGateDisabled reports whether the user opted out of the gate.
func versionGateDisabled() bool {
	if forceUnsupportedSpotify {
		utils.PrintWarning("Skipping Spotify version support check (--force-unsupported-spotify). The client may break.")
		return true
	}
	if settingSection != nil && !settingSection.Key("spotify_version_check").MustBool(true) {
		utils.PrintWarning("Skipping Spotify version support check (spotify_version_check=0). The client may break.")
		return true
	}
	return false
}

// detectSpotifyVersion resolves the installed Spotify version, preferring
// the app bundle/binary over prefs. Prefs lag real updates and are empty on
// fresh installs. Returns the raw version string and where it came from.
func detectSpotifyVersion() (raw string, source string) {
	if v := utils.GetInstalledSpotifyVersion(spotifyPath); v != "" {
		return v, "install"
	}
	if prefsPath != "" {
		if v := utils.GetSpotifyVersion(prefsPath); v != "" {
			return v, "prefs"
		}
	}
	return "", ""
}

// loadSupportList resolves and loads supported-versions.json across the
// search paths (binary dir first, then config folder).
func loadSupportList() (*utils.SupportList, string, error) {
	path, err := utils.FindSupportedVersionsFile()
	if err != nil {
		return nil, "", err
	}
	list, err := utils.LoadSupportedVersions(path)
	if err != nil {
		return nil, path, err
	}
	return list, path, nil
}

// RequireSupportedSpotify exits if the installed Spotify version is not in
// supported-versions.json, unless the user opted out via flag or config.
// A missing or unreadable support list fails open with a warning so
// package-manager installs (which may not ship the file yet) keep working.
func RequireSupportedSpotify() {
	if versionGateDisabled() {
		return
	}

	raw, _ := detectSpotifyVersion()
	if raw == "" {
		// Fail open, matching the missing-list behavior below: an
		// undetectable version (e.g. Linux fresh install with empty prefs)
		// must not hard-block backup/apply when the pre-gate CLI proceeded.
		utils.PrintWarning("Cannot determine the installed Spotify version; continuing without the support check.")
		utils.PrintInfo("Launch Spotify once (or set spotify_path in config-xpui.ini) to re-enable it.")
		return
	}

	list, _, err := loadSupportList()
	if err != nil {
		utils.PrintWarning("Cannot verify Spotify version support: " + err.Error())
		utils.PrintInfo("Continuing without the support check. Reinstall or upgrade Spicetify to restore it.")
		return
	}

	if err := list.CheckSupported(raw); err != nil {
		// Before hard-blocking, see if a nearest-lower classmap can carry this
		// build (v2-style cross-release resilience via degrade-not-destroy).
		if fb := fallbackClassmapFor(raw); fb != "" {
			utils.PrintWarning(fmt.Sprintf(
				"Spotify %s has no verified classmap; falling back to the closest one (%s). Some chrome may be off until support ships.",
				raw, fb))
			return
		}
		utils.PrintError(err.Error() + ".")
		utils.PrintInfo("Supported versions: " + list.SupportedSummary())
		utils.PrintInfo("Install a supported Spotify build, or upgrade Spicetify when support is added.")
		utils.PrintInfo("To override (may break the client): --force-unsupported-spotify")
		utils.PrintInfo("Or set spotify_version_check=0 in config-xpui.ini")
		os.Exit(1)
	}
}

// SpotifySupportedForAuto reports whether auto should re-backup/apply.
// Unlike RequireSupportedSpotify it never exits: when the version is
// unsupported or unknown it warns and returns false so the caller can
// launch Spotify untouched instead of blocking startup. A missing support
// list fails open (returns true) to preserve pre-gate behavior.
func SpotifySupportedForAuto() bool {
	if versionGateDisabled() {
		return true
	}

	raw, _ := detectSpotifyVersion()
	if raw == "" {
		utils.PrintWarning("Cannot determine the installed Spotify version; launching Spotify without applying.")
		return false
	}

	list, _, err := loadSupportList()
	if err != nil {
		utils.PrintWarning("Cannot verify Spotify version support: " + err.Error())
		return true
	}

	if err := list.CheckSupported(raw); err != nil {
		normalized, _ := utils.NormalizeSpotifyVersion(raw)
		if fb := fallbackClassmapFor(raw); fb != "" {
			utils.PrintWarning(fmt.Sprintf(
				"Spotify %s has no verified classmap; applying with the closest one (%s). Some chrome may be off.",
				firstNonEmpty(normalized, raw), fb))
			return true
		}
		utils.PrintWarning(fmt.Sprintf(
			"Spotify %s is not supported by this Spicetify release; launching Spotify without applying.",
			firstNonEmpty(normalized, raw),
		))
		utils.PrintInfo("Supported versions: " + list.SupportedSummary())
		utils.PrintInfo("Upgrade Spicetify when support is added, or use --force-unsupported-spotify to override.")
		return false
	}
	return true
}

// fallbackClassmapFor returns the nearest-lower classmap key usable for an
// otherwise-unsupported version (patch-level fallback within the same minor),
// or "" when none exists. This is what lets an unverified Spotify build still
// apply via degrade-not-destroy instead of being hard-rejected -- the only
// resilience available on Linux, where updates bypass the update-block.
func fallbackClassmapFor(rawVersion string) string {
	reqKey, err := utils.SpotifyVersionToClassmapKey(rawVersion)
	if err != nil {
		return ""
	}
	resolved, isFallback, err := utils.ResolveClassmapKey(reqKey)
	if err != nil || !isFallback {
		return ""
	}
	return resolved
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

// modularApplyEnabled reports whether a modular apply should run: the
// installed version has modular status and modules + classmap are present.
// Users without v3 modules installed see no behavior change.
func modularApplyEnabled() bool {
	raw, _ := detectSpotifyVersion()
	if raw == "" {
		return false
	}
	report := utils.EvaluateSpotifySupport(raw, "")
	if report.Map.Status == utils.ClassmapStatusModular && utils.HasModularApplyInput(report.Map.ClassmapKey) {
		return true
	}
	// No exact modular classmap: run modular apply against the nearest-lower
	// one when available (classmap dirs exist only for modular versions).
	if fb := fallbackClassmapFor(raw); fb != "" {
		return utils.HasModularApplyInput(fb)
	}
	return false
}
