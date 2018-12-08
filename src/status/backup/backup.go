package backupstatus

import (
	"io/ioutil"
	"log"
	"strings"

	"../../utils"
)

// Enum is type of backup status constants
type Enum int

const (
	// EMPTY No backup found
	EMPTY Enum = iota
	// BACKUPED There is available backup
	BACKUPED
	// OUTDATED Available backup has different version from Spotify version
	OUTDATED
)

// Get returns status of backup folder
func Get(spotifyPath, backupPath, backupVersion string) Enum {
	fileList, err := ioutil.ReadDir(backupPath)
	if err != nil {
		log.Fatal(err)
	}

	if len(fileList) == 0 {
		return EMPTY
	}

	spaCount := 0
	for _, file := range fileList {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".spa") {
			spaCount++
		}
	}

	if spaCount > 0 {
		spotifyVersion := utils.GetSpotifyVersion(spotifyPath)

		if backupVersion != spotifyVersion {
			return OUTDATED
		}

		return BACKUPED
	}

	return EMPTY
}
