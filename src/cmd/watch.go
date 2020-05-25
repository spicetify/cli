package cmd

import (
	"os"
	"path/filepath"

	spotifystatus "github.com/khanhas/spicetify-cli/src/status/spotify"
	"github.com/khanhas/spicetify-cli/src/utils"
)

var (
	debuggerURL    string
	autoReloadFunc func()
)

// Watch .
func Watch(liveUpdate bool) {
	if !isValidForWatching() {
		os.Exit(1)
	}

	InitSetting()

	if liveUpdate {
		startDebugger()
	}

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

			updateAssets()
			utils.PrintSuccess(utils.PrependTime("Custom assets are updated"))
		}, autoReloadFunc)
	}

	utils.Watch(fileList, func(_ string, err error) {
		if err != nil {
			utils.Fatal(err)
		}

		InitSetting()
		updateCSS()
		utils.PrintSuccess(utils.PrependTime("Custom CSS is updated"))
	}, autoReloadFunc)
}

// WatchExtensions .
func WatchExtensions(liveUpdate bool) {
	if !isValidForWatching() {
		os.Exit(1)
	}

	if liveUpdate {
		startDebugger()
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

	utils.Watch(extPathList, func(filePath string, err error) {
		if err != nil {
			utils.PrintError(err.Error())
			os.Exit(1)
		}

		pushExtensions(filePath)

		utils.PrintSuccess(utils.PrependTime(`Extension "` + filePath + `" is updated.`))
	}, autoReloadFunc)
}

func isValidForWatching() bool {
	status := spotifystatus.Get(appDestPath)

	if !status.IsModdable() {
		utils.PrintError(`You haven't applied. Run "spicetify apply" once before entering watch mode.`)
		return false
	}

	return true
}

func startDebugger() {
	if len(utils.GetDebuggerPath()) == 0 {
		RestartSpotify("--remote-debugging-port=9222")
		utils.PrintInfo("Spotify is restarted with debugger on. Waiting...")
		for len(utils.GetDebuggerPath()) == 0 {
			// Wait until debugger is up
		}
	}
	autoReloadFunc = func() {
		if utils.SendReload(&debuggerURL) != nil {
			utils.PrintError("Could not Reload Spotify")
			utils.PrintInfo(`Close Spotify and run "spicetify watch -e -l" again.`)
		} else {
			utils.PrintSuccess("Spotify reloaded")
		}
	}
}
