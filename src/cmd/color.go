package cmd

import (
	"log"
	"path/filepath"
	"strings"

	"github.com/go-ini/ini"
	"github.com/spicetify/spicetify-cli/src/utils"
)

const (
	nameMaxLen = 42
)

// EditColor changes one or multiple colors' values
func EditColor(args []string) {
	if !initCmdColor() {
		return
	}

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

		if len(utils.BaseColorList[field]) > 0 {
			colorSection.NewKey(field, color)
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

	if !colorFileOk {
		return
	}

	for _, k := range utils.BaseColorOrder {
		colorString := ""
		if colorFileOk {
			colorString = colorSection.Key(k).String()
		}

		if len(colorString) == 0 {
			colorString = utils.BaseColorList[k]
			k += " (*)"
		}

		out := formatName(k) + formatColor(colorString)
		log.Println(out)
	}

	for _, v := range colorSection.Keys() {
		key := v.Name()

		if len(utils.BaseColorList[key]) != 0 {
			continue
		}

		out := formatName(key) + formatColor(v.String())
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
	utils.PrintInfo(`Run "spicetify update" to apply new color`)
}

func formatColor(value string) string {
	color := utils.ParseColor(value)
	return "\x1B[48;2;" + color.TerminalRGB() + "m     \033[0m | " + color.Hex() + " | " + color.RGB()
}

func formatName(name string) string {
	nameLen := len(name)
	if nameLen > nameMaxLen {
		name = name[:(nameMaxLen - 3)]
		name += "..."
		nameLen = nameMaxLen
	}
	return utils.Bold(name) + strings.Repeat(" ", nameMaxLen-nameLen)
}
