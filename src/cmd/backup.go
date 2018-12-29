package cmd

import (
	"io/ioutil"
	"log"
	"os"
	"path/filepath"

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
		utils.PrintWarning("There is available backup, clear current backup first!")
		ClearBackup()
		backupSection.Key("version").SetValue("")
		cfg.Write()
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

	preprocSec := cfg.GetSection("Preprocesses")

	tracker.Reset()

	utils.PrintBold("Preprocessing:")

	preprocess.Start(
		rawFolder,
		preprocess.Flag{
			DisableSentry:  preprocSec.Key("disable_sentry").MustInt(0) == 1,
			DisableLogging: preprocSec.Key("disable_ui_logging").MustInt(0) == 1,
			RemoveRTL:      preprocSec.Key("remove_rtl_rule").MustInt(0) == 1,
			ExposeAPIs:     preprocSec.Key("expose_apis").MustInt(0) == 1,
		},
		tracker.Update,
	)

	tracker.Finish()

	utils.Copy(rawFolder, themedFolder, true, []string{".html", ".js", ".css"})

	tracker.Reset()

	preprocess.StartCSS(themedFolder, tracker.Update)
	tracker.Finish()

	backupSection.Key("version").SetValue(utils.GetSpotifyVersion(prefsPath))
	cfg.Write()
	utils.PrintSuccess("Everything is ready, you can start applying now!")
}

// ClearBackup .
func ClearBackup() {
	if !quiet {
		if !utils.ReadAnswer("Before clearing backup, make sure you have restored or re-installed Spotify to original state. Continue? [y/N]: ", false) {
			os.Exit(1)
		}
	}

	os.RemoveAll(backupFolder)
	os.RemoveAll(rawFolder)
	os.RemoveAll(themedFolder)

	backupSection.Key("version").SetValue("")
	cfg.Write()
}

// Restore .
func Restore() {
	backupVersion := backupSection.Key("version").MustString("")
	curBackupStatus := backupstatus.Get(prefsPath, backupFolder, backupVersion)

	if curBackupStatus == backupstatus.EMPTY {
		utils.PrintError(`You haven't backed up.`)
		os.Exit(1)
	} else if curBackupStatus == backupstatus.OUTDATED {
		if !quiet {
			utils.PrintWarning("Spotify version and backup version are mismatched.")
			if !utils.ReadAnswer("Continue restoring anyway? [y/N] ", false) {
				os.Exit(1)
			}
		}
	}

	appFolder := filepath.Join(spotifyPath, "Apps")

	os.RemoveAll(appFolder)
	utils.Copy(backupFolder, appFolder, false, []string{".spa"})
	utils.PrintSuccess("Spotify is restored.")
	RestartSpotify()
}
