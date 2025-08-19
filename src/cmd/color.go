package cmd

import (
	"path/filepath"

	"github.com/go-ini/ini"
	"github.com/pterm/pterm"
	"github.com/spicetify/cli/src/utils"
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

// DisplayColors prints out every color name, hex and rgb value.
func DisplayColors() {
	if !initCmdColor() {
		return
	}
	data := pterm.TableData{
		{"Name", "Preview", "Hex", "RGB"},
	}
	for _, k := range utils.BaseColorOrder {
		colorString := colorSection.Key(k).String()

		if len(colorString) == 0 {
			colorString = utils.BaseColorList[k]
			k += " (*)"
		}

		color := utils.ParseColor(colorString)
		data = append(data, []string{utils.Bold(k), colorPreview(color), color.Hex(), color.RGB()})
	}

	for _, v := range colorSection.Keys() {
		k := v.Name()

		if len(utils.BaseColorList[k]) != 0 {
			continue
		}

		color := utils.ParseColor(v.String())
		data = append(data, []string{utils.Bold(k), colorPreview(color), color.Hex(), color.RGB()})
	}

	pterm.DefaultTable.WithHasHeader().WithData(data).Render()

	utils.PrintNote("(*): Default color is used")
}

func colorChangeSuccess(field, value string) {
	utils.PrintSuccess(`Color changed: ` + field + ` = ` + value)
	utils.PrintInfo(`Run "spicetify refresh" to apply new color(s)`)
}

func colorPreview(color utils.Color) string {
	return "\x1B[48;2;" + color.TerminalRGB() + "m       \033[0m"
}
