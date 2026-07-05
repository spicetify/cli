package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	backupstatus "github.com/spicetify/cli/src/status/backup"
	spotifystatus "github.com/spicetify/cli/src/status/spotify"
	"github.com/spicetify/cli/src/utils"
)

// Doctor runs a series of diagnostic checks on the Spotify installation,
// backup state, and spicetify config, reporting anything that looks broken.
func Doctor() {
	utils.PrintBold("Running spicetify doctor")

	problems := 0
	pass := func(msg string) {
		utils.PrintSuccess(msg)
	}
	fail := func(msg string) {
		utils.PrintError(msg)
		problems++
	}

	spotifyPathCfg := utils.ReplaceEnvVarsInString(settingSection.Key("spotify_path").String())
	prefsPathCfg := utils.ReplaceEnvVarsInString(settingSection.Key("prefs_path").String())

	spotifyAppsPath := filepath.Join(spotifyPathCfg, "Apps")
	_, appsErr := os.Stat(spotifyAppsPath)
	if appsErr == nil {
		pass("Spotify installation found at \"" + spotifyPathCfg + "\"")
	} else {
		fail("Spotify installation not found at \"" + spotifyPathCfg + "\". Run \"spicetify config spotify_path <path>\" to fix it, or reinstall Spotify")
	}

	_, prefsErr := os.Stat(prefsPathCfg)
	if prefsErr == nil {
		pass("Spotify \"prefs\" file found at \"" + prefsPathCfg + "\"")
	} else {
		fail("Spotify \"prefs\" file not found at \"" + prefsPathCfg + "\". Launch Spotify at least once, then run \"spicetify config prefs_path <path>\" to fix it")
	}

	if runtime.GOOS == "windows" && (strings.Contains(spotifyPathCfg, "SpotifyAB.SpotifyMusic") || strings.Contains(prefsPathCfg, "SpotifyAB.SpotifyMusic")) {
		utils.PrintWarning("Spotify was installed via Microsoft Store, which is only partly supported")
	}

	if appsErr == nil {
		spotStat := spotifystatus.Get(spotifyAppsPath)
		switch {
		case spotStat.IsInvalid():
			fail("Spotify \"Apps\" folder is empty or invalid. Reinstall Spotify")
		case spotStat.IsMixed():
			fail("Spotify has a mix of modified and stock files, likely from a recent Spotify update. Run \"spicetify backup apply\" to fix it")
		case spotStat.IsStock():
			pass("Spotify is in stock (unmodified) state")
		case spotStat.IsApplied():
			pass("Spotify has spicetify customizations applied")
		}

		if prefsErr == nil {
			backupVersion := backupSection.Key("version").MustString("")
			backStat := backupstatus.Get(prefsPathCfg, backupFolder, backupVersion)
			switch {
			case backStat.IsEmpty():
				fail("No backup found. Run \"spicetify backup\"")
			case backStat.IsOutdated():
				fail("Backup version doesn't match installed Spotify version. Run \"spicetify backup apply\"")
			default:
				pass("Backup is up to date with installed Spotify version")
			}
		}
	}

	themeName := settingSection.Key("current_theme").String()
	if len(themeName) == 0 {
		pass("No theme selected")
	} else {
		themeFolder := findThemeFolder(themeName)
		if len(themeFolder) == 0 {
			fail("Theme \"" + themeName + "\" is set as current_theme but its folder cannot be found")
		} else {
			pass("Theme \"" + themeName + "\" found")
			checkThemeAsset(themeFolder, "replace_colors", "color.ini", pass, fail)
			checkThemeAsset(themeFolder, "inject_css", "user.css", pass, fail)
			checkThemeAsset(themeFolder, "inject_theme_js", "theme.js", pass, fail)
			checkThemeAsset(themeFolder, "overwrite_assets", "assets", pass, fail)
		}
	}

	for _, ext := range featureSection.Key("extensions").Strings("|") {
		if len(ext) == 0 {
			continue
		}
		if _, err := utils.GetExtensionPath(ext); err != nil {
			fail("Extension \"" + ext + "\" is enabled in config but its file cannot be found")
		}
	}

	for _, app := range featureSection.Key("custom_apps").Strings("|") {
		if len(app) == 0 {
			continue
		}
		if _, err := utils.GetCustomAppPath(app); err != nil {
			fail("Custom app \"" + app + "\" is enabled in config but cannot be found")
		}
	}

	if problems == 0 {
		utils.PrintSuccess("No problems found")
		return
	}

	utils.PrintWarning(fmt.Sprintf("%d problem(s) found", problems))
	os.Exit(1)
}

func checkThemeAsset(themeFolder, settingKey, assetName string, pass, fail func(string)) {
	if !settingSection.Key(settingKey).MustBool(false) {
		return
	}

	if _, err := os.Stat(filepath.Join(themeFolder, assetName)); err != nil {
		fail("\"" + settingKey + "\" is enabled but \"" + assetName + "\" is missing from theme \"" + filepath.Base(themeFolder) + "\"")
		return
	}

	pass("\"" + settingKey + "\" asset \"" + assetName + "\" found in theme \"" + filepath.Base(themeFolder) + "\"")
}
