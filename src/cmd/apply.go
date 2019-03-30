package cmd

import (
	"errors"
	"log"
	"os"
	"path/filepath"

	"github.com/khanhas/spicetify-cli/src/apply"
	backupstatus "github.com/khanhas/spicetify-cli/src/status/backup"
	spotifystatus "github.com/khanhas/spicetify-cli/src/status/spotify"
	"github.com/khanhas/spicetify-cli/src/utils"
)

// Apply .
func Apply() {
	backupVersion := backupSection.Key("version").MustString("")
	curBackupStatus := backupstatus.Get(prefsPath, backupFolder, backupVersion)
	status := spotifystatus.Get(spotifyPath)

	if curBackupStatus == backupstatus.EMPTY {
		if status == spotifystatus.STOCK {
			utils.PrintError(`You haven't backed up. Run "spicetify backup apply".`)
		} else {
			utils.PrintError(`You haven't backed up and Spotify cannot be backed up at this state. Please re-install Spotify then run "spicetify backup apply".`)
		}
		os.Exit(1)
	} else if curBackupStatus == backupstatus.OUTDATED {
		utils.PrintWarning("Spotify version and backup version are mismatched.")
		if status == spotifystatus.STOCK {
			utils.PrintInfo(`Please run "spicetify backup apply".`)
		} else {
			utils.PrintInfo(`Spotify cannot be backed up at this state. Please re-install Spotify then run "spicetify backup apply".`)
		}

		if !ReadAnswer("Continue applying anyway? [y/N] ", false, true) {
			os.Exit(1)
		}
	}

	appFolder := filepath.Join(spotifyPath, "Apps")

	// Copy raw assets to Spotify Apps folder if Spotify is never applied
	// before.
	// extractedStock is for preventing copy raw assets 2 times when
	// replaceColors is false.
	extractedStock := false
	if status != spotifystatus.APPLIED {
		if err := os.RemoveAll(appFolder); err != nil {
			utils.Fatal(err)
		}
		if err := utils.Copy(rawFolder, appFolder, true, nil); err != nil {
			utils.Fatal(err)
		}
		extractedStock = true
	}

	themeFolder, injectCSS, replaceColors := getThemeSettings()

	if replaceColors {
		if err := utils.Copy(themedFolder, appFolder, true, nil); err != nil {
			utils.Fatal(err)
		}
	} else if !extractedStock {
		if err := utils.Copy(rawFolder, appFolder, true, nil); err != nil {
			utils.Fatal(err)
		}
	}

	apply.UserCSS(
		appFolder,
		themeFolder,
		injectCSS,
		replaceColors,
	)

	extentionList := featureSection.Key("extensions").Strings("|")
	customAppsList := featureSection.Key("custom_apps").Strings("|")

	apply.AdditionalOptions(appFolder, apply.Flag{
		ExperimentalFeatures: featureSection.Key("experimental_features").MustInt(0) == 1,
		FastUserSwitching:    featureSection.Key("fastUser_switching").MustInt(0) == 1,
		Home:                 featureSection.Key("home").MustInt(0) == 1,
		LyricAlwaysShow:      featureSection.Key("lyric_always_show").MustInt(0) == 1,
		LyricForceNoSync:     featureSection.Key("lyric_force_no_sync").MustInt(0) == 1,
		MadeForYouHub:        featureSection.Key("made_for_you_hub").MustInt(0) == 1,
		Radio:                featureSection.Key("radio").MustInt(0) == 1,
		SongPage:             featureSection.Key("song_page").MustInt(0) == 1,
		VisHighFramerate:     featureSection.Key("visualization_high_framerate").MustInt(0) == 1,
		Extension:            extentionList,
		CustomApp:            customAppsList,
	})

	pushExtensions(extentionList...)

	pushApps(customAppsList...)

	utils.PrintSuccess("Spotify is spiced up!")
	RestartSpotify()
}

// UpdateCSS updates user.css file in Spotify
func UpdateCSS() {
	appFolder := filepath.Join(spotifyPath, "Apps")

	themeFolder, injectCSS, replaceColors := getThemeSettings()
	if len(themeFolder) == 0 {
		utils.PrintWarning(`Nothing is updated: Config "current_theme" is blank.`)
		os.Exit(1)
	}

	apply.UserCSS(
		appFolder,
		themeFolder,
		injectCSS,
		replaceColors,
	)

	utils.PrintSuccess(utils.PrependTime("Custom CSS is updated"))
}

// UpdateAllExtension pushs all extensions to Spotify
func UpdateAllExtension() {
	pushExtensions(featureSection.Key("extensions").Strings("|")...)
	utils.PrintSuccess(utils.PrependTime("All extensions are updated."))
}

// getThemeSettings returns
// - Theme path
// - Whether Spicetify should inject css
// - Whether Spicetify should replace colors
func getThemeSettings() (string, bool, bool) {
	replaceColors := settingSection.Key("replace_colors").MustInt(0) == 1
	injectCSS := settingSection.Key("inject_css").MustInt(0) == 1

	themeKey, err := settingSection.GetKey("current_theme")

	if err != nil {
		log.Fatal(err)
	}

	themeName := themeKey.String()
	themeFolder := ""

	if len(themeName) == 0 {
		injectCSS = false
		replaceColors = false
	} else {
		themeFolder = getThemeFolder(themeName)
	}

	return themeFolder, injectCSS, replaceColors
}

func getExtensionPath(name string) (string, error) {
	extFilePath := filepath.Join(spicetifyFolder, "Extensions", name)

	if _, err := os.Stat(extFilePath); err == nil {
		return extFilePath, nil
	}

	extFilePath = filepath.Join(utils.GetExecutableDir(), "Extensions", name)

	if _, err := os.Stat(extFilePath); err == nil {
		return extFilePath, nil
	}

	return "", errors.New("Extension not found")
}

func pushExtensions(list ...string) {
	if len(list) > 0 {
		zlinkFolder := filepath.Join(spotifyPath, "Apps", "zlink")

		for _, v := range list {
			extPath, err := getExtensionPath(v)
			if err != nil {
				utils.PrintError(`Extension "` + v + `" not found.`)
				continue
			}

			if err = utils.CopyFile(extPath, zlinkFolder); err != nil {
				utils.PrintError(err.Error())
				continue
			}
		}
	}
}

func getCustomAppPath(name string) (string, error) {
	customAppFolderPath := filepath.Join(spicetifyFolder, "CustomApps", name)

	if _, err := os.Stat(customAppFolderPath); err == nil {
		return customAppFolderPath, nil
	}

	customAppFolderPath = filepath.Join(utils.GetExecutableDir(), "CustomApps", name)

	if _, err := os.Stat(customAppFolderPath); err == nil {
		return customAppFolderPath, nil
	}

	return "", errors.New("Custom app not found")
}

func pushApps(list ...string) {
	if len(list) > 0 {
		appFolder := filepath.Join(spotifyPath, "Apps")

		for _, name := range list {
			customAppPath, err := getCustomAppPath(name)
			if err != nil {
				utils.PrintError(`Custom app "` + name + `" not found.`)
				continue
			}

			customAppDestPath := filepath.Join(appFolder, name)

			if err = utils.CreateJunction(customAppPath, customAppDestPath); err != nil {
				utils.Fatal(err)
			}
		}
	}
}
