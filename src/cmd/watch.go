package cmd

import (
	"os"
	"path/filepath"

	spotifystatus "github.com/khanhas/spicetify-cli/src/status/spotify"
	"github.com/khanhas/spicetify-cli/src/utils"
)

// Watch .
func Watch() {
	if !isValidForWatching() {
		os.Exit(1)
	}

	appFolder := filepath.Join(spotifyPath, "Apps")
	themeFolder, injectCSS, replaceColors, overwriteAssets := getThemeSettings()

	if len(themeFolder) == 0 {
		utils.PrintError(`Config "current_theme" is blank. No theme asset to watch.`)
		os.Exit(1)
	}

	colorPath := filepath.Join(themeFolder, "color.ini")
	cssPath := filepath.Join(themeFolder, "user.css")

	fileList := []string{}
	if replaceColors {
		fileList = append(fileList, colorPath)
	}

	if injectCSS {
		fileList = append(fileList, cssPath)
	}

	if overwriteAssets {
		assetPath := filepath.Join(themeFolder, "assets")

		go utils.WatchRecursive(assetPath, func(_ string, err error) {
			if err != nil {
				utils.Fatal(err)
			}

			updateAssets(appFolder, themeFolder)
		})
	}

	utils.Watch(fileList, func(_ string, err error) {
		if err != nil {
			utils.Fatal(err)
		}

		updateCSS(appFolder, themeFolder, injectCSS, replaceColors)
	})
}

// WatchExtensions .
func WatchExtensions() {
	if !isValidForWatching() {
		os.Exit(1)
	}

	extNameList := featureSection.Key("extensions").Strings("|")
	var extPathList []string

	for _, v := range extNameList {
		extPath, err := getExtensionPath(v)
		if err != nil {
			utils.PrintError(`Extension "` + v + `" not found.`)
			continue
		}
		extPathList = append(extPathList, extPath)
	}

	if len(extPathList) == 0 {
		utils.PrintError("No extension to watch.")
		os.Exit(1)
	}

	zlinkFolder := filepath.Join(spotifyPath, "Apps", "zlink")

	utils.Watch(extPathList, func(filePath string, err error) {
		if err != nil {
			utils.PrintError(err.Error())
			os.Exit(1)
		}

		if err = utils.CopyFile(filePath, zlinkFolder); err != nil {
			utils.PrintError(err.Error())
			os.Exit(1)
		}

		utils.PrintSuccess(utils.PrependTime(`Extension "` + filePath + `" is updated.`))
	})
}

func isValidForWatching() bool {
	status := spotifystatus.Get(spotifyPath)

	if !status.IsModdable() {
		utils.PrintError(`You haven't applied. Run "spicetify apply" once before entering watch mode.`)
		return false
	}

	return true
}
