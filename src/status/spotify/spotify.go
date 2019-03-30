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
	// MIXED Spotify has modified files and stock files
	MIXED
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
		} else if strings.HasSuffix(file.Name(), ".spa") {
			spaCount++
		}
	}

	if spaCount > 0 && dirCount > 0 {
		return MIXED
	} else if spaCount > 0 {
		return STOCK
	} else if dirCount > 0 {
		return APPLIED
	}

	return INVALID
}
