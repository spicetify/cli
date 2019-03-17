package cmd

import (
	"io/ioutil"
	"log"
	"os"
	"path/filepath"

	spotifystatus "github.com/khanhas/spicetify-cli/src/status/spotify"

	"github.com/khanhas/spicetify-cli/src/backup"
	"github.com/khanhas/spicetify-cli/src/preprocess"
	backupstatus "github.com/khanhas/spicetify-cli/src/status/backup"
	"github.com/khanhas/spicetify-cli/src/utils"
)

// Backup .
func Backup() {
	backupVersion := backupSection.Key("version").MustString("")
	curBackupStatus := backupstatus.Get(prefsPath, backupFolder, backupVersion)
	if curBackupStatus != backupstatus.EMPTY {
		utils.PrintInfo("There is available backup, clear current backup:")
		ClearBackup()
	}

	utils.PrintBold("Backing up app files:")

	if err := backup.Start(spotifyPath, backupFolder); err != nil {
		log.Fatal(err)
	}

	appList, err := ioutil.ReadDir(backupFolder)
	if err != nil {
		log.Fatal(err)
	}

	totalApp := len(appList)
	if totalApp > 0 {
		utils.PrintGreen("OK")
	} else {
		utils.PrintError("Cannot backup app files. Reinstall Spotify and try again.")
		os.Exit(1)
	}

	utils.PrintBold("Extracting:")
	tracker := utils.NewTracker(totalApp)

	if quiet {
		tracker.Quiet()
	}

	backup.Extract(backupFolder, rawFolder, tracker.Update)
	tracker.Finish()

	tracker.Reset()

	utils.PrintBold("Preprocessing:")

	preprocess.Start(
		rawFolder,
		preprocess.Flag{
			DisableSentry:  preprocSection.Key("disable_sentry").MustInt(0) == 1,
			DisableLogging: preprocSection.Key("disable_ui_logging").MustInt(0) == 1,
			RemoveRTL:      preprocSection.Key("remove_rtl_rule").MustInt(0) == 1,
			ExposeAPIs:     preprocSection.Key("expose_apis").MustInt(0) == 1,
			StopAutoUpdate: preprocSection.Key("stop_autoupdate").MustInt(0) == 1,
		},
		tracker.Update,
	)

	tracker.Finish()

	err = utils.Copy(rawFolder, themedFolder, true, []string{".html", ".js", ".css"})
	if err != nil {
		utils.Fatal(err)
	}

	tracker.Reset()

	preprocess.StartCSS(themedFolder, tracker.Update)
	tracker.Finish()

	backupSection.Key("version").SetValue(utils.GetSpotifyVersion(prefsPath))
	cfg.Write()
	utils.PrintSuccess("Everything is ready, you can start applying now!")
}

// ClearBackup .
func ClearBackup() {
	curSpotifystatus := spotifystatus.Get(spotifyPath)

	if curSpotifystatus != spotifystatus.STOCK && !quiet {
		utils.PrintWarning("Before clearing backup, please restore or re-install Spotify to stock state.")
		if !utils.ReadAnswer("Continue clearing anyway? [y/N]: ", false) {
			os.Exit(1)
		}
	}

	if err := os.RemoveAll(backupFolder); err != nil {
		utils.Fatal(err)
	}
	os.Mkdir(backupFolder, 0700)

	if err := os.RemoveAll(rawFolder); err != nil {
		utils.Fatal(err)
	}
	os.Mkdir(rawFolder, 0700)

	if err := os.RemoveAll(themedFolder); err != nil {
		utils.Fatal(err)
	}
	os.Mkdir(themedFolder, 0700)

	backupSection.Key("version").SetValue("")
	cfg.Write()
	utils.PrintSuccess("Backup is cleared.")
}

// Restore .
func Restore() {
	backupVersion := backupSection.Key("version").MustString("")
	curBackupStatus := backupstatus.Get(prefsPath, backupFolder, backupVersion)
	curSpotifystatus := spotifystatus.Get(spotifyPath)

	if curBackupStatus == backupstatus.EMPTY {
		utils.PrintError(`You haven't backed up.`)
		if curSpotifystatus != spotifystatus.STOCK {
			utils.PrintWarning(`But Spotify cannot be backed up at this state. Please re-install Spotify then run "spicetify backup"`)
		}
		os.Exit(1)
	} else if curBackupStatus == backupstatus.OUTDATED {
		utils.PrintWarning("Spotify version and backup version are mismatched.")
		if curSpotifystatus == spotifystatus.STOCK {
			utils.PrintInfo(`Spotify is at stock state. Run "spicetify backup" to backup current Spotify version.`)
		}
		if !quiet && !utils.ReadAnswer("Continue restoring anyway? [y/N] ", false) {
			os.Exit(1)
		}
	}

	appFolder := filepath.Join(spotifyPath, "Apps")

	if err := os.RemoveAll(appFolder); err != nil {
		utils.Fatal(err)
	}

	if err := utils.Copy(backupFolder, appFolder, false, []string{".spa"}); err != nil {
		utils.Fatal(err)
	}

	utils.PrintSuccess("Spotify is restored.")
	RestartSpotify()
}
