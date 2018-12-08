package spotifystatus

import (
	"io/ioutil"
	"log"
	"path/filepath"
	"strings"
)

// Enum is type of Spotify status constants
type Enum int

const (
	// STOCK Spotify is in original state
	STOCK Enum = iota
	// INVALID Apps folder has mixing files and directories
	INVALID
	// APPLIED Spotify is modified
	APPLIED
)

// Get returns status of Spotify's Apps folder
func Get(spotifyPath string) Enum {
	appsFolder := filepath.Join(spotifyPath, "Apps")
	fileList, err := ioutil.ReadDir(appsFolder)
	if err != nil {
		log.Fatal(err)
	}

	spaCount := 0
	dirCount := 0
	for _, file := range fileList {
		if file.IsDir() {
			dirCount++
			continue
		}

		if strings.HasSuffix(file.Name(), ".spa") {
			spaCount++
		}
	}

	totalFiles := len(fileList)
	if spaCount == totalFiles {
		return STOCK
	}

	if dirCount == totalFiles {
		return APPLIED
	}

	return INVALID
}
