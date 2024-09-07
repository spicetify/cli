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
func BlockSpotifyUpdates(disabled bool) {
	if runtime.GOOS == "linux" {
		utils.PrintError("Auto-updates on linux should be disabled in package manager you installed spotify with.")
		return
	}
	spotifyExecPath := GetSpotifyPath()
	switch runtime.GOOS {
	case "windows":
		spotifyExecPath = filepath.Join(spotifyExecPath, "Spotify.exe")
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
	if disabled {
		str = "no/thanks"
		msg = "Disabled"
	} else {
		str = "v2/update"
		msg = "Enabled"
	}
	file.WriteAt([]byte(str), int64(i+15))
	utils.PrintSuccess(msg + " Spotify updates!")
}
