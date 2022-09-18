package cmd

import (
	"fmt"

	"github.com/spicetify/spicetify-cli/src/utils"
)

// ShowConfigDirectory shows config directory in user's default file manager application
func ShowConfigDirectory(quiet bool) {
	configDir := utils.GetSpicetifyFolder()
	if quiet {
		fmt.Println(configDir)
		return
	}
	err := utils.ShowDirectory(configDir)
	if err != nil {
		utils.PrintError("Error opening config directory:")
		utils.Fatal(err)
	}
}
