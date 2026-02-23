package backup

import (
	"path/filepath"
	"strings"

	"github.com/spicetify/cli/src/utils"
)

// Start backing up Spotify Apps folder to backupPath
func Start(appPath, backupPath string) error {
	return utils.Copy(appPath, backupPath, false, []string{".spa"})
}

// Extract all SPA files from backupPath to extractPath.
// Discovers .spa files dynamically so new Spotify apps are
// automatically handled.
func Extract(backupPath, extractPath string) {
	spinner, _ := utils.Spinner.Start("Extracting backup")

	spaFiles, _ := filepath.Glob(filepath.Join(backupPath, "*.spa"))
	for _, spaFile := range spaFiles {
		appName := strings.TrimSuffix(filepath.Base(spaFile), ".spa")
		appExtractToFolder := filepath.Join(extractPath, appName)

		err := utils.Unzip(spaFile, appExtractToFolder)
		if err != nil {
			spinner.Fail("Failed to extract backup")
			utils.Fatal(err)
		}
	}
	spinner.Success("Extracted backup")
}
