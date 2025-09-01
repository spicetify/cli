package backup

import (
	"os"
	"path/filepath"

	"github.com/spicetify/cli/src/utils"
)

// Start backing up Spotify Apps folder to backupPath
func Start(appPath, backupPath string) error {
	return utils.Copy(appPath, backupPath, false, []string{".spa"})
}

// Extract all SPA files from backupPath to extractPath
func Extract(backupPath, extractPath string) {
	spinner, _ := utils.Spinner.Start("Extracting backup")
	for _, app := range []string{"xpui", "login"} {
		appPath := filepath.Join(backupPath, app+".spa")
		appExtractToFolder := filepath.Join(extractPath, app)

		_, err := os.Stat(appPath)
		if err != nil {
			continue
		}

		err = utils.Unzip(appPath, appExtractToFolder)
		if err != nil {
			spinner.Fail("Failed to extract backup")
			utils.Fatal(err)
		}
	}
	spinner.Success("Extracted backup")
}
