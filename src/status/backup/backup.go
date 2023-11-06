package backupstatus

import (
	"log"
	"os"
	"strings"

	"github.com/spicetify/spicetify-cli/src/utils"
)

type status struct {
	state int
}

// Status .
type Status interface {
	IsBackuped() bool
	IsEmpty() bool
	IsOutdated() bool
}

const (
	// EMPTY No backup found
	EMPTY int = iota
	// BACKUPED There is available backup
	BACKUPED
	// OUTDATED Available backup has different version from Spotify version
	OUTDATED
)

// Get returns status of backup folder
func Get(prefsPath, backupPath, backupVersion string) Status {
	fileList, err := os.ReadDir(backupPath)
	if err != nil {
		log.Fatal(err)
	}

	cur := EMPTY

	if len(fileList) != 0 {
		spaCount := 0
		for _, file := range fileList {
			if !file.IsDir() && strings.HasSuffix(file.Name(), ".spa") {
				spaCount++
			}
		}

		if spaCount > 0 {
			spotifyVersion := utils.GetSpotifyVersion(prefsPath)

			if backupVersion != spotifyVersion {
				cur = OUTDATED
			} else {
				cur = BACKUPED
			}
		}
	}

	return status{
		state: cur}
}

func (s status) IsBackuped() bool {
	return s.state == BACKUPED
}

func (s status) IsEmpty() bool {
	return s.state == EMPTY
}

func (s status) IsOutdated() bool {
	return s.state == OUTDATED
}
