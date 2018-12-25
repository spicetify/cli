package cmd

import (
	"bytes"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"time"

	"../status/spotify"
	"../utils"
)

// Watch .
func Watch() {
	status := spotifystatus.Get(spotifyPath)

	if status != spotifystatus.APPLIED {
		utils.PrintError(`You haven't applied. Run "spicetify apply" once before entering watch mode.`)
		os.Exit(1)
	}

	themeName, err := settingSection.GetKey("current_theme")

	if err != nil {
		log.Fatal(err)
	}

	themeFolder := getThemeFolder(themeName.MustString("SpicetifyDefault"))
	colorPath := filepath.Join(themeFolder, "color.ini")
	cssPath := filepath.Join(themeFolder, "user.css")

	var colorCache []byte
	var cssCache []byte

	for {
		shouldUpdate := false
		currColor, err := ioutil.ReadFile(colorPath)
		if err != nil {
			utils.PrintError(err.Error())
			os.Exit(1)
		}
		currCSS, err := ioutil.ReadFile(cssPath)
		if err != nil {
			utils.PrintError(err.Error())
			os.Exit(1)
		}

		if !bytes.Equal(colorCache, currColor) {
			shouldUpdate = true
			colorCache = currColor
		}

		if !bytes.Equal(cssCache, currCSS) {
			shouldUpdate = true
			cssCache = currCSS
		}

		if shouldUpdate {
			UpdateCSS()
		}

		time.Sleep(200 * time.Millisecond)
	}
}

// WatchExtensions .
func WatchExtensions() {
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
