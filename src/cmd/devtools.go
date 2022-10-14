package cmd

import (
	"bytes"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/spicetify/spicetify-cli/src/utils"
)

// SetDevTool enables/disables developer mode of Spotify client
func SetDevTools() {
	var filePath string

	switch runtime.GOOS {
	case "windows":
		appFilePath := os.Getenv("LOCALAPPDATA") + "\\Spotify\\offline.bnk"
		if _, err := os.Stat(appFilePath); err == nil {
			filePath = appFilePath
		} else if len(utils.WinXApp()) != 0 && len(utils.WinXPrefs()) != 0 {
			dir, _ := filepath.Split(utils.WinXPrefs())
			filePath = filepath.Join(dir, "offline.bnk")
		}
	case "linux":
		{
			homePath := os.Getenv("HOME")
			snapSpotifyHome := homePath + "/snap/spotify/common"
			if _, err := os.Stat(snapSpotifyHome); err == nil {
				homePath = snapSpotifyHome
			}

			flatpakHome := homePath + "/.var/app/com.spotify.Client"
			if _, err := os.Stat(flatpakHome); err == nil {
				homePath = flatpakHome
				filePath = homePath + "/cache/spotify/offline.bnk"
			} else {
				filePath = homePath + "/.cache/spotify/offline.bnk"
			}

		}
	case "darwin":
		filePath = os.Getenv("HOME") + "/Library/Application Support/Spotify/PersistentCache/offline.bnk"
	}

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		utils.PrintError("Can't find \"offline.bnk\". Try running spotify first.")
		os.Exit(1)
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
