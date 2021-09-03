package cmd

import (
	"io/ioutil"
	"log"
	"os"

	spotifystatus "github.com/khanhas/spicetify-cli/src/status/spotify"

	"github.com/khanhas/spicetify-cli/src/backup"
	"github.com/khanhas/spicetify-cli/src/preprocess"
	backupstatus "github.com/khanhas/spicetify-cli/src/status/backup"
	"github.com/khanhas/spicetify-cli/src/utils"
)

// Backup stores original apps packages, extracts them and preprocesses
// extracted apps' assets
func Backup(spicetifyVersion string) {
	backupVersion := backupSection.Key("version").MustString("")
	backStat := backupstatus.Get(prefsPath, backupFolder, backupVersion)
	if !backStat.IsEmpty() {
		utils.PrintInfo("There is available backup.")
		utils.PrintInfo("Clear current backup:")

		spotStat := spotifystatus.Get(appPath)
		if spotStat.IsBackupable() {
			clearBackup()

		} else {
			utils.PrintWarning(`After clearing backup, Spotify cannot be backed up again.`)
			utils.PrintInfo(`Please restore first then backup, run "spicetify restore backup" or re-install Spotify then run "spicetify backup".`)
			os.Exit(1)
		}
	}

	utils.PrintBold("Backing up app files:")

	if err := backup.Start(appPath, backupFolder); err != nil {
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
	backup.Extract(backupFolder, rawFolder)
	utils.PrintGreen("OK")

	utils.PrintBold("Preprocessing:")

	preprocess.Start(
		spicetifyVersion,
		rawFolder,
		preprocess.Flag{
			DisableSentry:  preprocSection.Key("disable_sentry").MustBool(false),
			DisableLogging: preprocSection.Key("disable_ui_logging").MustBool(false),
			RemoveRTL:      preprocSection.Key("remove_rtl_rule").MustBool(false),
			ExposeAPIs:     preprocSection.Key("expose_apis").MustBool(false),
			DisableUpgrade: preprocSection.Key("disable_upgrade_check").MustBool(false),
		},
	)
	utils.PrintGreen("OK")

	err = utils.Copy(rawFolder, themedFolder, true, []string{".html", ".js", ".css"})
	if err != nil {
		utils.Fatal(err)
	}

	preprocess.StartCSS(themedFolder)
	utils.PrintGreen("OK")

	backupSection.Key("version").SetValue(utils.GetSpotifyVersion(prefsPath))
	backupSection.Key("with").SetValue(spicetifyVersion)
	cfg.Write()
	utils.PrintSuccess("Everything is ready, you can start applying now!")
}

// Clear clears current backup. Before clearing, it checks whether Spotify is in
// valid state to backup again.
func Clear() {
	spotStat := spotifystatus.Get(appPath)

	if !spotStat.IsBackupable() {
		utils.PrintWarning("Before clearing backup, please restore or re-install Spotify to stock state.")
		if !ReadAnswer("Continue clearing anyway? [y/N]: ", false, true) {
			os.Exit(1)
		}
	}

	clearBackup()
}

func clearBackup() {
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
	backupSection.Key("with").SetValue("")
	cfg.Write()
	utils.PrintSuccess("Backup is cleared.")
}

// Restore uses backup to revert every changes made by Spicetify.
func Restore() {
	backupVersion := backupSection.Key("version").MustString("")
	backStat := backupstatus.Get(prefsPath, backupFolder, backupVersion)
	spotStat := spotifystatus.Get(appPath)

	if backStat.IsEmpty() {
		utils.PrintError(`You haven't backed up.`)

		if !spotStat.IsBackupable() {
			utils.PrintWarning(`But Spotify cannot be backed up at this state. Please re-install Spotify then run "spicetify backup"`)
		}
		os.Exit(1)

	} else if backStat.IsOutdated() {
		utils.PrintWarning("Spotify version and backup version are mismatched.")

		if spotStat.IsBackupable() {
			utils.PrintInfo(`Spotify is at stock state. Run "spicetify backup" to backup current Spotify version.`)
		}

		if !ReadAnswer("Continue restoring anyway? [y/N] ", false, true) {
			os.Exit(1)
		}
	}

	if err := os.RemoveAll(appDestPath); err != nil {
		utils.Fatal(err)
	}

	if err := utils.Copy(backupFolder, appDestPath, false, []string{".spa"}); err != nil {
		utils.Fatal(err)
	}

	utils.PrintSuccess("Spotify is restored.")
}
