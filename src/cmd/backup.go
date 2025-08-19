package cmd

import (
	"os"

	spotifystatus "github.com/spicetify/cli/src/status/spotify"

	"github.com/spicetify/cli/src/backup"
	"github.com/spicetify/cli/src/preprocess"
	backupstatus "github.com/spicetify/cli/src/status/backup"
	"github.com/spicetify/cli/src/utils"
)

// Backup stores original apps packages, extracts them and preprocesses extracted apps' assets
// If silent is true, the final readiness message is surpressed (useful when chaining with "apply")
func Backup(spicetifyVersion string, silent bool) {
	if isAppX {
		utils.PrintInfo(`You are using the Microsoft Store version of Spotify, which is only partly supported.
Don't use the Microsoft Store version with Spicetify unless you absolutely CANNOT install Spotify from its installer.
Modded Spotify cannot be launched using original Shortcut/Start menu tile. To correctly launch modified Spotify, make a desktop shortcut that executes "spicetify auto". After that, you can change its icon, pin it to the start menu or put it in the startup folder.`)
		if !ReadAnswer("Continue backing up anyway?", false, true) {
			os.Exit(1)
		}
	}
	backupVersion := backupSection.Key("version").MustString("")
	backStat := backupstatus.Get(prefsPath, backupFolder, backupVersion)
	if !backStat.IsEmpty() {
		utils.PrintInfo("A backup is available")

		spotStat := spotifystatus.Get(appPath)
		if spotStat.IsBackupable() {
			clearBackup()
		} else {
			utils.PrintWarning(`After clearing backup, Spotify cannot be backed up again`)
			utils.PrintInfo(`Please restore first then backup, run "spicetify restore backup" or re-install Spotify then run "spicetify backup"`)
			os.Exit(1)
		}
	}

	spinner, _ := utils.Spinner.Start("Backup app files")

	if err := backup.Start(appPath, backupFolder); err != nil {
		spinner.Fail()
		utils.Fatal(err)
	}

	appList, err := os.ReadDir(backupFolder)
	if err != nil {
		spinner.Fail()
		utils.Fatal(err)
	}

	totalApp := len(appList)
	if totalApp > 0 {
		spinner.Success()
	} else {
		spinner.Fail()
		utils.PrintInfo("Reinstall Spotify and try again")
		os.Exit(1)
	}

	backup.Extract(backupFolder, rawFolder)

	utils.PrintBold("Preprocessing")

	spotifyBasePath := spotifyPath
	if spotifyBasePath == "" {
		utils.PrintError("Spotify installation path not found. Cannot preprocess V8 snapshots")
	} else {
		preprocess.Start(
			spicetifyVersion,
			spotifyBasePath,
			rawFolder,
			preprocess.Flag{
				DisableSentry:  preprocSection.Key("disable_sentry").MustBool(false),
				DisableLogging: preprocSection.Key("disable_ui_logging").MustBool(false),
				RemoveRTL:      preprocSection.Key("remove_rtl_rule").MustBool(false),
				ExposeAPIs:     preprocSection.Key("expose_apis").MustBool(false),
				SpotifyVer:     utils.GetSpotifyVersion(prefsPath)},
		)
		utils.PrintSuccess("Preprocessing completed")
	}

	err = utils.Copy(rawFolder, themedFolder, true, []string{".html", ".js", ".css"})
	if err != nil {
		utils.Fatal(err)
	}

	preprocess.StartCSS(themedFolder)

	backupSection.Key("version").SetValue(utils.GetSpotifyVersion(prefsPath))
	backupSection.Key("with").SetValue(spicetifyVersion)
	cfg.Write()
	if !silent {
		utils.PrintSuccess("Everything is ready, you can start applying!")
	}
}

// Clear clears current backup. Before clearing, it checks whether Spotify is in
// valid state to backup again.
func Clear() {
	spotStat := spotifystatus.Get(appPath)

	if !spotStat.IsBackupable() {
		utils.PrintWarning("Before clearing backup, please restore or re-install Spotify to stock state")
		os.Exit(1)
	}

	clearBackup()
}

func clearBackup() {
	spinner, _ := utils.Spinner.Start("Clear current backup")
	if err := os.RemoveAll(backupFolder); err != nil {
		spinner.Fail()
		utils.Fatal(err)
	}
	os.Mkdir(backupFolder, 0700)

	if err := os.RemoveAll(rawFolder); err != nil {
		spinner.Fail()
		utils.Fatal(err)
	}
	os.Mkdir(rawFolder, 0700)

	if err := os.RemoveAll(themedFolder); err != nil {
		spinner.Fail()
		utils.Fatal(err)
	}
	os.Mkdir(themedFolder, 0700)

	backupSection.Key("version").SetValue("")
	backupSection.Key("with").SetValue("")
	cfg.Write()
	spinner.Success()
}

// Restore uses backup to revert every changes made by Spicetify.
func Restore() {
	CheckStates()
	spinner, _ := utils.Spinner.Start("Restore Spotify")
	if err := os.RemoveAll(appDestPath); err != nil {
		spinner.Fail()
		utils.Fatal(err)
	}

	if err := utils.Copy(backupFolder, appDestPath, false, []string{".spa"}); err != nil {
		spinner.Fail()
		utils.Fatal(err)
	}

	spinner.Success()
}
