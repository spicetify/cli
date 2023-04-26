package cmd

import (
	"log"
	"os"
	"strings"

	"github.com/go-ini/ini"
	"github.com/spicetify/spicetify-cli/src/utils"
)

// EditConfig changes one or multiple config value
func EditConfig(args []string) {
	for len(args) >= 2 {
		field := args[0]
		value := args[1]

		switch field {
		case "extensions", "custom_apps":
			arrayType(featureSection, field, value)
		case "spotify_launch_flags":
			continue
		case "prefs_path", "spotify_path", "current_theme", "color_scheme":
			stringType(settingSection, field, value)

		default:
			toggleType(field, value)
		}

		args = args[2:]
	}

	cfg.Write()
}

// DisplayAllConfig displays all configs in all sections
func DisplayAllConfig() {
	maxLen := 30
	utils.PrintBold("Settings")
	for _, key := range settingSection.Keys() {
		name := key.Name()
		log.Println(name + strings.Repeat(" ", maxLen-len(name)) + key.Value())
	}

	log.Println()
	utils.PrintBold("Preprocesses")
	for _, key := range preprocSection.Keys() {
		name := key.Name()
		log.Println(name + strings.Repeat(" ", maxLen-len(name)) + key.Value())
	}

	log.Println()
	utils.PrintBold("AdditionalFeatures")
	for _, key := range featureSection.Keys() {
		name := key.Name()
		if name == "extensions" || name == "custom_apps" || name == "spotify_launch_flags" {
			list := key.Strings("|")
			listLen := len(list)
			if listLen == 0 {
				log.Println(name)
			} else {
				log.Println(name + strings.Repeat(" ", maxLen-len(name)) + strings.Join(list, " | "))
			}
		} else {
			log.Println(name + strings.Repeat(" ", maxLen-len(name)) + key.Value())
		}
	}

	log.Println()
	utils.PrintBold("Backup")
	for _, key := range backupSection.Keys() {
		name := key.Name()
		log.Println(name + strings.Repeat(" ", maxLen-len(name)) + key.Value())
	}
}

// DisplayConfig displays value of requested config field
func DisplayConfig(field string) {
	key := searchField(field)

	name := key.Name()
	if name == "extensions" || name == "custom_apps" {
		list := key.Strings("|")
		for _, ext := range list {
			log.Println(ext)
		}
		return
	}

	log.Println(key.Value())
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
	utils.PrintInfo(`Run "spicetify apply" to apply new config`)
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

	isSubstract := value[len(value)-1] == '-'
	if isSubstract {
		value = value[0 : len(value)-1]
		found := false
		newList := []string{}
		for _, v := range allExts {
			if value == v {
				found = true
			} else {
				newList = append(newList, v)
			}
		}

		if !found {
			unchangeWarning(field, value+" is not on the list.")
			return
		}

		allExts = newList
	} else {
		for _, ext := range allExts {
			if value == ext {
				unchangeWarning(field, value+" is already in the list.")
				return
			}
		}

		allExts = append(allExts, value)
	}

	newList := strings.Join(allExts, "|")
	key.SetValue(newList)
	changeSuccess(field, newList)
}

func stringType(section *ini.Section, field, value string) {
	key, err := section.GetKey(field)
	if err != nil {
		utils.Fatal(err)
	}
	if len(strings.TrimSpace(value)) == 0 || value[len(value)-1] == '-' {
		value = ""
	}
	key.SetValue(value)

	changeSuccess(field, value)
}

func toggleType(field, value string) {
	key := searchField(field)

	if value != "0" && value != "1" && value != "-1" {
		unchangeWarning(field, `"`+value+`" is not valid value. Only "0", "1" or "-1".`)
		return
	}

	key.SetValue(value)
	changeSuccess(field, value)
}
