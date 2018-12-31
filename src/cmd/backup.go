package cmd

import (
	"github.com/khanhas/spicetify-cli/src/status/spotify"
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
		if !utils.ReadAnswer("Before clearing backup, make sure you have restored or re-installed Spotify to original state. Continue? [y/N]: ", false) {
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

	if err := os.RemoveAll(appFolder); err != nil {
		utils.Fatal(err)
	}
	
	if err := utils.Copy(backupFolder, appFolder, false, []string{".spa"}); err != nil {
		utils.Fatal(err)
	}
	
	utils.PrintSuccess("Spotify is restored.")
	RestartSpotify()
}
