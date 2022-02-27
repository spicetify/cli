package backup

import (
	"os"
	"path/filepath"

	"github.com/spicetify/spicetify-cli/src/utils"
)

// Start backing up Spotify Apps folder to backupPath
func Start(appPath, backupPath string) error {
	return utils.Copy(appPath, backupPath, false, []string{".spa"})
}

// Extract all SPA files from backupPath to extractPath
func Extract(backupPath, extractPath string) {
	// TODO: "settings" no longer exists in > 1.1.62, remove it when Linux Spotify is updated.
	for _, app := range []string{"xpui", "login", "settings"} {
		appPath := filepath.Join(backupPath, app+".spa")
		appExtractToFolder := filepath.Join(extractPath, app)

		_, err := os.Stat(appPath)
		if err != nil {
			continue
		}

		err = utils.Unzip(appPath, appExtractToFolder)
		if err != nil {
			utils.Fatal(err)
		}
	}
}
