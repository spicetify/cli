package cmd

import (
	"errors"
	"path/filepath"
	"strings"

	"github.com/khanhas/spicetify-cli/src/utils"
)

// ThemeAssetPath returns path of theme assets color.ini and user.css
func ThemeAssetPath(kind string) (string, error) {
	InitSetting()

	if len(themeFolder) == 0 {
		return "", errors.New(`Config "current_theme" is blank`)
	}

	if kind == "color" {
		color := filepath.Join(themeFolder, "color.ini")
		return color, nil
	} else if kind == "css" {
		css := filepath.Join(themeFolder, "user.css")
		return css, nil
	} else if kind == "assets" {
		assets := filepath.Join(themeFolder, "assets")
		return assets, nil
	}

	return "", errors.New(`Unrecognized theme assets kind. Only "color", "css" or "assets" is valid`)
}

// ThemeAllAssetsPath returns paths of all theme's assets
func ThemeAllAssetsPath() (string, error) {
	InitSetting()

	if len(themeFolder) == 0 {
		return "", errors.New(`Config "current_theme" is blank`)
	}

	results := []string{
		filepath.Join(themeFolder, "color.ini"),
		filepath.Join(themeFolder, "user.css"),
		filepath.Join(themeFolder, "assets")}

	return strings.Join(results, "\n"), nil
}

// ExtensionPath return path of extension file
func ExtensionPath(name string) (string, error) {
	return utils.GetExtensionPath(name)
}

// ExtensionAllPath returns paths of all extension files
func ExtensionAllPath() (string, error) {
	exts := featureSection.Key("extensions").Strings("|")
	results := []string{}
	for _, v := range exts {
		path, err := utils.GetExtensionPath(v)
		if err != nil {
			path = utils.Red("Extension " + v + " not found")
		}
		results = append(results, path)
	}

	return strings.Join(results, "\n"), nil
}

// AppPath return path of app directory
func AppPath(name string) (string, error) {
	return utils.GetCustomAppPath(name)
}

// AppAllPath returns paths of all apps
func AppAllPath() (string, error) {
	exts := featureSection.Key("custom_apps").Strings("|")
	results := []string{}
	for _, v := range exts {
		path, err := utils.GetCustomAppPath(v)
		if err != nil {
			path = utils.Red("App " + v + " not found")
		}
		results = append(results, path)
	}

	return strings.Join(results, "\n"), nil
}
