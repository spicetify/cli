package cmd

import (
	"log"
	"path/filepath"
	"strings"

	"github.com/go-ini/ini"
	"github.com/khanhas/spicetify-cli/src/utils"
)

// EditColor changes one or multiple colors' values
func EditColor(args []string) {
	initCmdColor()

	for len(args) >= 2 {
		field := args[0]
		value := args[1]
		args = args[2:]

		color := utils.ParseColor(value).Hex()

		if key, err := colorSection.GetKey(field); err == nil {
			key.SetValue(color)
			colorChangeSuccess(field, color)
			continue
		}

		utils.PrintWarning(`Color "` + field + `" unchanged: Not found.`)
	}

	colorCfg.SaveTo(filepath.Join(themeFolder, "color.ini"))
}

// DisplayColors prints out every color name, hex and rgb value.
func DisplayColors() {
	colorFileOk := initCmdColor()

	nameMaxLen := 42

	for _, k := range utils.BaseColorOrder {
		colorString := ""
		if colorFileOk {
			colorString = colorSection.Key(k).String()
		}
		keyLen := len(k)
		if len(colorString) == 0 {
			colorString = utils.BaseColorList[k]
			k += " (*)"
			keyLen += 4
		}
		k = utils.Bold(k)
		out := k + strings.Repeat(" ", nameMaxLen-keyLen) + formatColor(utils.ParseColor(colorString))
		log.Println(out)
	}
	log.Println("\n(*): Default color is used")
}

func initCmdColor() bool {
	var err error

	themeName := settingSection.Key("current_theme").String()

	if len(themeName) == 0 {
		utils.PrintError(`Config "current_theme" is blank.`)
		return false
	}

	themeFolder = getThemeFolder(themeName)

	colorPath := filepath.Join(themeFolder, "color.ini")

	colorCfg, err = ini.InsensitiveLoad(colorPath)
	if err != nil {
		utils.PrintError("Cannot open file " + colorPath)
		return false
	}

	sections := colorCfg.Sections()

	if len(sections) < 2 {
		utils.PrintError("No section found in " + colorPath)
		return false
	}

	schemeName := settingSection.Key("color_scheme").String()
	if len(schemeName) == 0 {
		colorSection = sections[1]
	} else {
		schemeSection, err := colorCfg.GetSection(schemeName)
		if err != nil {
			colorSection = sections[1]
		} else {
			colorSection = schemeSection
		}
	}

	return true
}

func colorChangeSuccess(field, value string) {
	utils.PrintSuccess(`Color changed: ` + field + ` = ` + value)
}

func formatColor(color utils.Color) string {
	return "\x1B[48;2;" + color.TerminalRGB() + "m     \033[0m | " + color.Hex() + " | " + color.RGB()
}
