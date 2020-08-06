package backup

import (
	"io/ioutil"
	"path/filepath"
	"strings"
	"sync"

	"github.com/khanhas/spicetify-cli/src/utils"
)

// Start backing up Spotify Apps folder to backupPath
func Start(appPath, backupPath string) error {
	return utils.Copy(appPath, backupPath, false, []string{".spa"})
}

// Extract all SPA files from backupPath to extractPath
// and call `callback` at every successfully extracted app
func Extract(backupPath, extractPath string, callback func(finishedApp string)) {
	appList, err := ioutil.ReadDir(backupPath)
	if err != nil {
		utils.Fatal(err)
	}

	var wg sync.WaitGroup

	for _, app := range appList {
		if !strings.HasSuffix(app.Name(), ".spa") {
			continue
		}

		wg.Add(1)
		appPath := filepath.Join(backupPath, app.Name())
		appName := strings.Replace(app.Name(), ".spa", "", 1)

		go func() {
			defer wg.Done()

			appExtractToFolder := filepath.Join(extractPath, appName)

			// Disable WebUI
			if appName == "xpui" {
				callback(appName)
				return
			}

			err := utils.Unzip(appPath, appExtractToFolder)
			if err != nil {
				utils.Fatal(err)
			}

			callback(appName)
		}()
	}

	wg.Wait()
}
