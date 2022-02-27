package cmd

import (
	"log"

	"github.com/go-ini/ini"
	"github.com/spicetify/spicetify-cli/src/utils"
)

// SetDevTool enables/disables developer mode of Spotify client
func SetDevTool(enable bool) {
	pref, err := ini.LoadSources(
		ini.LoadOptions{
			PreserveSurroundedQuote: true,
		},
		prefsPath)

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
	if pref.SaveTo(prefsPath) == nil {
		if enable {
			utils.PrintSuccess("DevTool enabled!")
		} else {
			utils.PrintSuccess("DevTool disabled!")
		}
	}
}
