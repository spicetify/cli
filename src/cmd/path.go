package cmd

import (
	"errors"
	"path/filepath"
)

// ThemeAssetPath returns path of theme assets color.ini and user.css
func ThemeAssetPath(kind string) (string, error) {
	themeName, _, _, _ := getThemeSettings()
	if len(themeName) == 0 {
		return "", errors.New(`Config "current_theme" is blank`)
	}

	if kind == "color" {
		color := filepath.Join(themeName, "color.ini")
		return color, nil
	} else if kind == "css" {
		css := filepath.Join(themeName, "user.css")
		return css, nil
	} else if kind == "assets" {
		assets := filepath.Join(themeName, "assets")
		return assets, nil
	}

	return "", errors.New(`Unrecognized theme assets kind. Only "color" or "css" is valid`)
}

// ExtensionPath return path of extension file
func ExtensionPath(name string) (string, error) {
	return getExtensionPath(name)
}

// AppPath return path of app directory
func AppPath(name string) (string, error) {
	return getCustomAppPath(name)
}
