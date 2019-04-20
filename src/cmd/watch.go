package cmd

import (
	"bytes"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"time"

	spotifystatus "github.com/khanhas/spicetify-cli/src/status/spotify"
	"github.com/khanhas/spicetify-cli/src/utils"
)

// Watch .
func Watch() {
	if !isValidForWatching() {
		os.Exit(1)
	}

	themeKey, err := settingSection.GetKey("current_theme")

	if err != nil {
		log.Fatal(err)
	}

	themeName := themeKey.String()
	if len(themeName) == 0 {
		utils.PrintError(`Config "current_theme" is blank. No theme asset to watch.`)
		os.Exit(1)
	}

	themeFolder := getThemeFolder(themeName)
	colorPath := filepath.Join(themeFolder, "color.ini")
	cssPath := filepath.Join(themeFolder, "user.css")

	checkColor := false
	checkCSS := false
	if _, err := os.Stat(colorPath); err == nil {
		checkColor = true
	}

	if _, err := os.Stat(cssPath); err == nil {
		checkCSS = true
	}

	var colorCache []byte
	var cssCache []byte

	for {
		shouldUpdate := false
		if checkColor {
			currColor, err := ioutil.ReadFile(colorPath)
			if err != nil {
				utils.PrintError(err.Error())
				os.Exit(1)
			}

			if !bytes.Equal(colorCache, currColor) {
				shouldUpdate = true
				colorCache = currColor
			}
		}

		if checkCSS {
			currCSS, err := ioutil.ReadFile(cssPath)
			if err != nil {
				utils.PrintError(err.Error())
				os.Exit(1)
			}

			if !bytes.Equal(cssCache, currCSS) {
				shouldUpdate = true
				cssCache = currCSS
			}
		}

		if shouldUpdate {
			UpdateCSS()
		}

		time.Sleep(200 * time.Millisecond)
	}
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

	var extCache = map[int][]byte{}

	for {
		for k, v := range extPathList {
			currExt, err := ioutil.ReadFile(v)
			if err != nil {
				utils.PrintError(err.Error())
				os.Exit(1)
			}

			if !bytes.Equal(extCache[k], currExt) {
				if err = utils.CopyFile(v, zlinkFolder); err != nil {
					utils.PrintError(err.Error())
					os.Exit(1)
				}
				extCache[k] = currExt

				utils.PrintSuccess(utils.PrependTime(`Extension "` + v + `" is updated.`))
			}
		}

		time.Sleep(200 * time.Millisecond)
	}
}

func isValidForWatching() bool {
	status := spotifystatus.Get(spotifyPath)

	if !status.IsModdable() {
		utils.PrintError(`You haven't applied. Run "spicetify apply" once before entering watch mode.`)
		return false
	}

	return true
}
