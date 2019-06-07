package cmd

import (
	"errors"
	"path/filepath"
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

// ExtensionPath return path of extension file
func ExtensionPath(name string) (string, error) {
	return getExtensionPath(name)
}

// AppPath return path of app directory
func AppPath(name string) (string, error) {
	return getCustomAppPath(name)
}
