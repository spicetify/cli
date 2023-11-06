package cmd

import (
	"errors"
	"path/filepath"
	"strings"

	"github.com/spicetify/spicetify-cli/src/utils"
)

// ThemeAssetPath returns path of theme; assets, color.ini, theme.js and user.css
func ThemeAssetPath(kind string) (string, error) {
	InitSetting()

	if kind == "root" {
		return filepath.Join(utils.GetExecutableDir(), "Themes"), nil
	} else if len(themeFolder) == 0 {
		return "", errors.New(`config "current_theme" is blank`)
	}

	if kind == "folder" {
		return themeFolder, nil
	} else if kind == "color" {
		color := filepath.Join(themeFolder, "color.ini")
		return color, nil
	} else if kind == "css" {
		css := filepath.Join(themeFolder, "user.css")
		return css, nil
	} else if kind == "js" {
		js := filepath.Join(themeFolder, "theme.js")
		return js, nil
	} else if kind == "assets" {
		assets := filepath.Join(themeFolder, "assets")
		return assets, nil
	}

	return "", errors.New(`unrecognized theme assets kind. only "root", "folder", "color", "css", "js" or "assets" is valid`)
}

// ThemeAllAssetsPath returns paths of all theme's assets
func ThemeAllAssetsPath() (string, error) {
	InitSetting()

	if len(themeFolder) == 0 {
		return "", errors.New(`config "current_theme" is blank`)
	}

	results := []string{
		themeFolder,
		filepath.Join(themeFolder, "color.ini"),
		filepath.Join(themeFolder, "user.css"),
		filepath.Join(themeFolder, "theme.js"),
		filepath.Join(themeFolder, "assets")}

	return strings.Join(results, "\n"), nil
}

// ExtensionPath return path of extension file
func ExtensionPath(name string) (string, error) {
	if name == "root" {
		return filepath.Join(utils.GetExecutableDir(), "Extensions"), nil
	}
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
	if name == "root" {
		return filepath.Join(utils.GetExecutableDir(), "CustomApps"), nil
	}
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

func AllPaths() (string, error) {
	theme, _ := ThemeAllAssetsPath()
	ext, _ := ExtensionAllPath()
	app, _ := AppAllPath()

	return strings.Join([]string{theme, ext, app}, "\n"), nil
}
