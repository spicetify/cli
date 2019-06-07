package cmd

import (
	"os"
	"strings"

	"github.com/go-ini/ini"
	"github.com/khanhas/spicetify-cli/src/utils"
)

// EditConfig changes one or multiple config value
func EditConfig(args []string) {
	if len(args) < 2 {
		utils.PrintError("Not enough argument.")
		os.Exit(1)
	}

	for len(args) >= 2 {
		field := args[0]
		value := args[1]

		switch field {
		case "extensions", "custom_apps":
			arrayType(featureSection, field, value)

		case "prefs_path", "spotify_path", "current_theme", "color_scheme":
			stringType(settingSection, field, value)

		default:
			toggleType(field, value)
		}

		args = args[2:]
	}

	cfg.Write()
}

// searchField finds requested field in all three config sections
func searchField(field string) *ini.Key {
	key, err := settingSection.GetKey(field)
	if err != nil {
		key, err = preprocSection.GetKey(field)
		if err != nil {
			key, err = featureSection.GetKey(field)
			if err != nil {
				unchangeWarning(field, `Not a valid field.`)
				os.Exit(1)
			}
		}
	}
	return key
}

func changeSuccess(key, value string) {
	utils.PrintSuccess(`Config changed: ` + key + ` = ` + value)
}

func unchangeWarning(field, reason string) {
	utils.PrintWarning(`Config "` + field + `" unchanged: ` + reason)
}

func arrayType(section *ini.Section, field, value string) {
	key, err := section.GetKey(field)
	if err != nil {
		utils.Fatal(err)
	}

	allExts := key.Strings("|")

	for _, ext := range allExts {
		if value == ext {
			unchangeWarning(field, value+" is already in the list.")
			return
		}
	}

	allExts = append(allExts, value)
	newList := strings.Join(allExts, "|")
	key.SetValue(newList)

	changeSuccess(field, newList)
}

func stringType(section *ini.Section, field, value string) {
	key, err := section.GetKey(field)
	if err != nil {
		utils.Fatal(err)
	}

	key.SetValue(value)

	changeSuccess(field, value)
}

func toggleType(field, value string) {
	key := searchField(field)

	if value != "0" && value != "1" {
		unchangeWarning(field, `"`+value+`" is not valid value. Only "0" or "1".`)
		return
	}

	key.SetValue(value)
	changeSuccess(field, value)
}
