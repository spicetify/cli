package cmd

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"../apply"
	"../status/backup"
	"../status/spotify"
	"../utils"
)

// Apply .
func Apply() {
	backupVersion := backupSection.Key("version").MustString("")
	curBackupStatus := backupstatus.Get(spotifyPath, backupFolder, backupVersion)

	if curBackupStatus == backupstatus.EMPTY {
		utils.PrintError(`You haven't backed up. Run "spicetify backup" before applying.`)
		os.Exit(1)
	} else if curBackupStatus == backupstatus.OUTDATED {
		if !quiet {
			utils.PrintWarning("Spotify version and backup version are mismatched.")
			if !utils.ReadAnswer("Continue applying anyway? [y/N] ", false) {
				os.Exit(1)
			}
		}
	}

	appFolder := filepath.Join(spotifyPath, "Apps")
	status := spotifystatus.Get(spotifyPath)

	if status != spotifystatus.APPLIED {
		os.RemoveAll(appFolder)
		utils.Copy(rawFolder, appFolder, true, nil)
	}

	replaceColors := settingSection.Key("replace_colors").MustInt(0) == 1
	injectCSS := settingSection.Key("inject_css").MustInt(0) == 1
	if replaceColors {
		utils.Copy(themedFolder, appFolder, true, nil)
	} else {
		utils.Copy(rawFolder, appFolder, true, nil)
	}

	themeName, err := settingSection.GetKey("current_theme")

	if err != nil {
		log.Fatal(err)
	}

	themeFolder := getThemeFolder(themeName.MustString("SpicetifyDefault"))

	apply.UserCSS(
		appFolder,
		themeFolder,
		injectCSS,
		replaceColors,
	)

	featureSec := cfg.GetSection("AdditionalOptions")

	apply.AdditionalOptions(appFolder, apply.Flag{
		ExperimentalFeatures: featureSec.Key("experimental_features").MustInt(0) == 1,
		FastUserSwitching:    featureSec.Key("fastUser_switching").MustInt(0) == 1,
		Home:                 featureSec.Key("home").MustInt(0) == 1,
		LyricAlwaysShow:      featureSec.Key("lyric_always_show").MustInt(0) == 1,
		LyricForceNoSync:     featureSec.Key("lyric_force_no_sync").MustInt(0) == 1,
		MadeForYouHub:        featureSec.Key("made_for_you_hub").MustInt(0) == 1,
		Radio:                featureSec.Key("radio").MustInt(0) == 1,
		SongPage:             featureSec.Key("song_page").MustInt(0) == 1,
		VisHighFramerate:     featureSec.Key("visualization_high_framerate").MustInt(0) == 1,
	})

	utils.PrintSuccess("Spotify is spiced up!")
	utils.RestartSpotify(spotifyPath)
}

// UpdateCSS .
func UpdateCSS() {
	appFolder := filepath.Join(spotifyPath, "Apps")
	themeName, err := settingSection.GetKey("current_theme")

	if err != nil {
		log.Fatal(err)
	}

	themeFolder := getThemeFolder(themeName.MustString("SpicetifyDefault"))

	apply.UserCSS(
		appFolder,
		themeFolder,
		settingSection.Key("inject_css").MustInt(0) == 1,
		settingSection.Key("replace_colors").MustInt(0) == 1,
	)

	date := time.Now()
	utils.PrintSuccess(fmt.Sprintf("user.css is updated at %02d:%02d:%02d", date.Hour(), date.Minute(), date.Second()))
}
