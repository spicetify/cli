package cmd

import (
	"bytes"
	"os"
	"os/exec"
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
		spotifyExecPath = filepath.Join(spotifyExecPath, "..", "MacOS", "Spotify")
	}

	var str, msg string
	if runtime.GOOS == "darwin" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			utils.PrintError("Cannot get user home directory")
			return
		}
		updateDir := homeDir + "/Library/Application Support/Spotify/PersistentCache/Update"
		if disabled {
			exec.Command("pkill", "Spotify").Run()
			exec.Command("mkdir", "-p", updateDir).Run()
			exec.Command("chflags", "uchg", updateDir).Run()
			msg = "Disabled"
		} else {
			exec.Command("pkill", "Spotify").Run()
			exec.Command("mkdir", "-p", updateDir).Run()
			exec.Command("chflags", "nouchg", updateDir).Run()
			msg = "Enabled"
		}

		utils.PrintSuccess(msg + " Spotify updates!")
		return
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
