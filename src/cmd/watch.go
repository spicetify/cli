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

var (
	colorCache []byte
	cssCache   []byte
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
