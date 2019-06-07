package backup

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/khanhas/spicetify-cli/src/utils"
)

// Start backing up Spotify Apps folder to backupPath
func Start(appPath, backupPath string) error {
	return utils.Copy(appPath, backupPath, false, []string{".spa"})
}

// Extract all SPA files from backupPath to extractPath
// and call `callback` at every successfully extracted app
func Extract(backupPath, extractPath string, callback func(finishedApp string)) {
	filepath.Walk(backupPath, func(appPath string, info os.FileInfo, err error) error {
		if !info.IsDir() && strings.HasSuffix(info.Name(), ".spa") {
			appName := strings.Replace(info.Name(), ".spa", "", 1)
			appExtractToFolder := filepath.Join(extractPath, appName)

			err := utils.Unzip(appPath, appExtractToFolder)
			if err != nil {
				utils.Fatal(err)
			}

			callback(appName)
		}

		return nil
	})
}
