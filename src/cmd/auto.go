package cmd

import (
	"os"

	backupstatus "github.com/khanhas/spicetify-cli/src/status/backup"
	spotifystatus "github.com/khanhas/spicetify-cli/src/status/spotify"
)

// Auto checks Spotify state, re-backup and apply if needed, then launch
// Spotify client normally.
func Auto() {
	backupVersion := backupSection.Key("version").MustString("")
	spotStat := spotifystatus.Get(spotifyPath)
	backStat := backupstatus.Get(prefsPath, backupFolder, backupVersion)

	if spotStat.IsBackupable() && (backStat.IsEmpty() || backStat.IsOutdated()) {
		Backup()
		backupVersion := backupSection.Key("version").MustString("")
		backStat = backupstatus.Get(prefsPath, backupFolder, backupVersion)
	}

	if !backStat.IsBackuped() {
		os.Exit(1)
	}

	if !spotStat.IsApplied() && backStat.IsBackuped() {
		Apply()
	}
}
