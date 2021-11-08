package cmd

import (
	"github.com/khanhas/spicetify-cli/src/utils"
)

// ShowConfigDirectory shows config directory in user's default file manager application
func ShowConfigDirectory() {
	configDir := utils.GetSpicetifyFolder()
	err := utils.ShowDirectory(configDir)
	if err != nil {
		utils.PrintError("Error opening config directory:")
		utils.Fatal(err)
	}
}
