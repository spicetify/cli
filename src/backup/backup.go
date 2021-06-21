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
func Extract(backupPath, extractPath string) {
	appPath := filepath.Join(backupPath, "xpui.spa")

	appExtractToFolder := filepath.Join(extractPath, "xpui")

	err := utils.Unzip(appPath, appExtractToFolder)
	if err != nil {
		utils.Fatal(err)
	}
}
