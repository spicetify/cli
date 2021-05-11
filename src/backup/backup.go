package backup

import (
	"path/filepath"

	"github.com/khanhas/spicetify-cli/src/utils"
)

// Start backing up Spotify Apps folder to backupPath
func Start(appPath, backupPath string) error {
	return utils.Copy(appPath, backupPath, false, []string{".spa"})
}

// Extract all SPA files from backupPath to extractPath
// and call `callback` at every successfully extracted app
func Extract(backupPath, extractPath string, callback func(finishedApp string)) {
	apps := []string{"xpui", "login", "settings", "glue-resources"}

	for _, v := range apps {
		appPath := filepath.Join(backupPath, v + ".spa")
		appName := v

		appExtractToFolder := filepath.Join(extractPath, appName)

		err := utils.Unzip(appPath, appExtractToFolder)
		if err != nil {
			utils.Fatal(err)
		}

		callback(appName)
	}
}
