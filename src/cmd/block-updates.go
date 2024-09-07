package cmd

import (
	"bytes"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/spicetify/cli/src/utils"
)

// Block spotify updates. Taken from https://github.com/Delusoire/bespoke-cli/blob/main/cmd/spotify/update.go
func BlockSpotifyUpdates(enabled bool) {
	spotifyExecPath := GetSpotifyPath()
	switch runtime.GOOS {
	case "windows":
		spotifyExecPath = filepath.Join(spotifyExecPath, "Spotify.exe")
	case "linux":
		spotifyExecPath = filepath.Join(spotifyExecPath, "spotify")
	case "darwin":
		spotifyExecPath = filepath.Join(spotifyExecPath, "Spotify")
	}

	file, err := os.OpenFile(spotifyExecPath, os.O_RDWR, 0644)
	if err != nil {
		utils.Fatal(err)
		return
	}
	defer file.Close()

	buf := new(bytes.Buffer)
	buf.ReadFrom(file)
	content := buf.String()

	i := strings.Index(content, "desktop-update/")
	if i == -1 {
		utils.PrintError("Can't find update endpoint in executable")
		return
	}
	var str, msg string
	if enabled {
		str = "v2/update"
		msg = "Enabled"
	} else {
		str = "no/thanks"
		msg = "Disabled"
	}
	file.WriteAt([]byte(str), int64(i+15))
	utils.PrintSuccess(msg + " Spotify updates!")
}
