package backup

import (
	"os"
	"path/filepath"
	"strings"

	"../utils"
)

// Start backing up Spotify Apps folder to backupPath
func Start(spotifyPath, backupPath string) error {
	appsFolder := filepath.Join(spotifyPath, "Apps")

	utils.RunCopy(appsFolder, backupPath, false, []string{"*.spa"})

	return nil
}

// Extract all SPA files from backupPath to extractPath
// and call `callback` at every successfully extracted app
func Extract(backupPath, extractPath string, callback func(finishedApp string, err error)) {
	filepath.Walk(backupPath, func(appPath string, info os.FileInfo, err error) error {
		if !info.IsDir() && strings.HasSuffix(info.Name(), ".spa") {
			appName := strings.Replace(info.Name(), ".spa", "", 1)
			appExtractToFolder := filepath.Join(extractPath, appName)

			err := utils.Unzip(appPath, appExtractToFolder)
			if err != nil {
				callback("", err)
			} else {
				callback(appName, nil)
			}
		}

		return nil
	})
}
