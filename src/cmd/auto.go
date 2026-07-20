package cmd

import (
	"os"

	backupstatus "github.com/spicetify/cli/src/status/backup"
	spotifystatus "github.com/spicetify/cli/src/status/spotify"
)

// Auto checks Spotify state, re-backup and apply if needed, then launch
// Spotify client normally.
//
// Auto is the launch wrapper, so the support gate is soft here: when the
// installed Spotify is unsupported (or its version is unknown) we warn and
// return without touching Spotify files. main still launches Spotify via
// SpotifyRestart, so music keeps working on unsupported versions.
func Auto(spicetifyVersion string) {
	if !SpotifySupportedForAuto() {
		return
	}

	backupVersion := backupSection.Key("version").MustString("")
	spotStat := spotifystatus.Get(appPath)
	backStat := backupstatus.Get(prefsPath, backupFolder, backupVersion)

	if spotStat.IsBackupable() && (backStat.IsEmpty() || backStat.IsOutdated()) {
		Backup(spicetifyVersion, true)
		backupVersion := backupSection.Key("version").MustString("")
		backStat = backupstatus.Get(prefsPath, backupFolder, backupVersion)
	}

	if !backStat.IsBackuped() {
		os.Exit(1)
	}

	if isAppX {
		spotStat = spotifystatus.Get(appDestPath)
	}

	if !spotStat.IsApplied() && backStat.IsBackuped() {
		CheckStates()
		InitSetting()
		Apply(spicetifyVersion)
	}
}
