package cmd

import (
	"log"

	"../utils"
	"github.com/go-ini/ini"
)

// SetDevTool enables/disables developer mode of Spotify client
func SetDevTool(enable bool) {
	pref, prefFilePath, err := utils.GetPrefsCfg(spotifyPath)
	if err != nil {
		log.Fatal(err)
	}

	rootSection, err := pref.GetSection("")
	if err != nil {
		log.Fatal(err)
	}

	devTool := rootSection.Key("app.enable-developer-mode")

	if enable {
		devTool.SetValue("true")
	} else {
		devTool.SetValue("false")
	}

	ini.PrettyFormat = false
	if pref.SaveTo(prefFilePath) == nil {
		if enable {
			utils.PrintSuccess("DevTool enabled! Restart your Spotify client.")
		} else {
			utils.PrintSuccess("DevTool disabled! Restart your Spotify client.")
		}
	}
}
