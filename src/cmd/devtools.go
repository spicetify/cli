package cmd

import (
	"bytes"
	"log"
	"os"
	"runtime"
	"strings"

	"github.com/spicetify/spicetify-cli/src/utils"
)

// SetDevTool enables/disables developer mode of Spotify client
func SetDevTools() {
	var filePath string

	switch runtime.GOOS {
	case "windows":
		filePath = os.Getenv("LOCALAPPDATA") + "\\Spotify\\offline.bnk"
	case "linux":
		{
			homePath := os.Getenv("HOME")
			snapSpotifyHome := homePath + "/snap/spotify/common"
			if _, err := os.Stat(snapSpotifyHome); os.IsNotExist(err) {
				filePath = os.Getenv("HOME") + "/.config/spotify/offline.bnk"
			}
		}
	case "darwin":
		filePath = os.Getenv("HOME") + "/Library/Application Support/Spotify/PersistentCache/offline.bnk"
	}

	file, err := os.OpenFile(filePath, os.O_RDWR, 0644)

	if err != nil {
		log.Fatal(err)
	}
	defer file.Close()

	buf := new(bytes.Buffer)
	buf.ReadFrom(file)
	content := buf.String()
	location := strings.LastIndex(content, "app-developer")
	patchLocation := int64(location + 15)

	file.WriteAt([]byte{50}, patchLocation)
	utils.PrintSuccess("Enabled DevTools!")
}
