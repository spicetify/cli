package spotifystatus

import (
	"log"
	"os"
	"strings"
)

type status struct {
	state int
}

// Status .
type Status interface {
	IsBackupable() bool
	IsModdable() bool
	IsStock() bool
	IsMixed() bool
	IsApplied() bool
	IsInvalid() bool
}

const (
	// STOCK Spotify is in original state
	STOCK int = iota
	// INVALID Apps folder is empty
	INVALID
	// APPLIED Spotify is modified
	APPLIED
	// MIXED Spotify has modified files and stock files
	MIXED
)

// Get returns status of Spotify's Apps folder
func Get(appsFolder string) Status {
	fileList, err := os.ReadDir(appsFolder)
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

	cur := INVALID
	if spaCount > 0 && dirCount > 0 {
		cur = MIXED
	} else if spaCount > 0 {
		cur = STOCK
	} else if dirCount > 0 {
		cur = APPLIED
	}

	return status{
		state: cur}
}

func (s status) IsBackupable() bool {
	return s.state == STOCK || s.state == MIXED
}

func (s status) IsModdable() bool {
	return s.state == APPLIED || s.state == MIXED
}

func (s status) IsStock() bool {
	return s.state == STOCK
}

func (s status) IsMixed() bool {
	return s.state == MIXED
}

func (s status) IsApplied() bool {
	return s.state == APPLIED
}

func (s status) IsInvalid() bool {
	return s.state == INVALID
}
