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
			if _, err := os.Stat(snapSpotifyHome); os.IsExist(err) {
				homePath = snapSpotifyHome
			}

			flatpackHome := homePath + "/.var/app/com.spotify.Client"
			if _, err := os.Stat(flatpackHome); os.IsExist(err) {
				homePath = flatpackHome
				filePath = homePath + "/cache/spotify/offline.bnk"
			} 
			else if _, err := os.Stat(filePath; os.IsExist(err) {
				filePath = homePath + "config/spotify/offline.bnk"	
			}
			else {
				filePath = homePath + "/.cache/spotify/offline.bnk"
			}

		}
	case "darwin":
		filePath = os.Getenv("HOME") + "/Library/Application Support/Spotify/PersistentCache/offline.bnk"
	}

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		log.Fatal("Can't find the offline.bnk file!")
	}

	file, err := os.OpenFile(filePath, os.O_RDWR, 0644)

	if err != nil {
		log.Fatal(err)
	}
	defer file.Close()

	buf := new(bytes.Buffer)
	buf.ReadFrom(file)
	content := buf.String()
	firstLocation := strings.Index(content, "app-developer")
	firstPatchLocation := int64(firstLocation + 14)

	secondLocation := strings.LastIndex(content, "app-developer")
	secondPatchLocation := int64(secondLocation + 15)

	file.WriteAt([]byte{50}, firstPatchLocation)
	file.WriteAt([]byte{50}, secondPatchLocation)
	utils.PrintSuccess("Enabled DevTools!")
}
