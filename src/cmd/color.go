package cmd

import (
	"log"
	"path/filepath"

	"github.com/go-ini/ini"
	"github.com/khanhas/spicetify-cli/src/utils"
)

// EditColor changes one or multiple colors' values
func EditColor(args []string) {
	themeName, err := settingSection.GetKey("current_theme")

	if err != nil {
		log.Fatal(err)
	}

	themeFolder := getThemeFolder(themeName.MustString("SpicetifyDefault"))

	colorFilePath := filepath.Join(themeFolder, "color.ini")
	colorCfg, err := ini.Load(colorFilePath)
	if err != nil {
		return
	}

	for len(args) >= 2 {
		field := args[0]
		value := args[1]
		args = args[2:]

		color := utils.ParseColor(value).Hex()

		if base, err := colorCfg.GetSection("Base"); err == nil {
			if key, err := base.GetKey(field); err == nil {
				key.SetValue(color)
				colorChangeSuccess(field, color)
				continue
			}
		}

		if more, err := colorCfg.GetSection("More"); err == nil {
			if key, err := more.GetKey(field); err == nil {
				key.SetValue(color)
				colorChangeSuccess(field, color)
				continue
			}
		}

		utils.PrintWarning(`Color "` + field + `" unchanged: Not found.`)
	}

	colorCfg.SaveTo(colorFilePath)
}

func colorChangeSuccess(field, value string) {
	utils.PrintSuccess(`Color changed: ` + field + ` = ` + value)
}
