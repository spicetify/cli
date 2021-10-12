package cmd

import (
	"encoding/json"
	"os"
	"path/filepath"
	"time"

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

		if _, err := os.Stat(assetPath); err == nil {
			go utils.WatchRecursive(assetPath, func(_ string, err error) {
				if err != nil {
					utils.Fatal(err)
				}
				
				updateAssets()
				utils.PrintSuccess(utils.PrependTime("Custom assets are updated"))
			}, autoReloadFunc)
		}
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
func WatchExtensions(extName []string, liveUpdate bool) {
	if !isValidForWatching() {
		os.Exit(1)
	}

	if liveUpdate {
		startDebugger()
	}

	var extNameList []string
	if len(extName) > 0 {
		extNameList = extName
	} else {
		extNameList = featureSection.Key("extensions").Strings("|")
	}

	var extPathList []string

	for _, v := range extNameList {
		extPath, err := utils.GetExtensionPath(v)
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

// WatchCustomApp .
func WatchCustomApp(appName []string, liveUpdate bool) {
	if !isValidForWatching() {
		os.Exit(1)
	}

	if liveUpdate {
		startDebugger()
	}

	var appNameList []string 
	if len(appName) > 0 {
		appNameList = appName
	} else {
		appNameList = featureSection.Key("custom_apps").Strings("|")
	}

	threadCount := 0
	for _, v := range appNameList {
		appPath, err := utils.GetCustomAppPath(v)
		if err != nil {
			utils.PrintError(`Custom app "` + v + `" not found.`)
			continue
		}
	
		var appFileList []string
		jsFilePath := filepath.Join(appPath, "index.js")
		if _, err := os.Stat(jsFilePath); err != nil {
			utils.PrintError(`Custom app "` + v + `" does not contain index.js`)
			continue
		}
		appFileList = append(appFileList, jsFilePath)
		cssFilePath := filepath.Join(appPath, "style.css")
		if _, err := os.Stat(cssFilePath); err == nil {
			appFileList = append(appFileList, cssFilePath)
		}

		manifestPath := filepath.Join(appPath, "manifest.json")
		manifestFileContent, err := os.ReadFile(manifestPath)
		if err == nil {
			var manifestJson utils.AppManifest
			if err = json.Unmarshal(manifestFileContent, &manifestJson); err == nil {
				for _, subfile := range(manifestJson.Files) {
					subfilePath := filepath.Join(appPath, subfile)
					appFileList = append(appFileList, subfilePath)
				}
				for _, subfile := range(manifestJson.ExtensionFiles) {
					subfilePath := filepath.Join(appPath, subfile)
					appFileList = append(appFileList, subfilePath)
				}
			}
			
		}

		threadCount += 1
		var appName = v
		go utils.Watch(appFileList, func(filePath string, err error) {
			if err != nil {
				utils.PrintError(err.Error())
				os.Exit(1)
			}
	
			pushApps(appName)
	
			utils.PrintSuccess(utils.PrependTime(`Custom app "` + appName + `" is updated.`))
		}, autoReloadFunc)
	}

	if threadCount > 0 {
		for {
			time.Sleep(utils.INTERVAL)
		}
	}
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
			utils.PrintInfo(`Close Spotify and run watch command again.`)
		} else {
			utils.PrintSuccess("Spotify reloaded")
		}
	}
}
