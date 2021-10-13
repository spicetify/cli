package utils

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
)

func GetSpicetifyFolder() string {
	result, isAvailable := os.LookupEnv("SPICETIFY_CONFIG")
	defer func() { CheckExistAndCreate(result) }()

	if isAvailable && len(result) > 0 {
		return result
	}

	if runtime.GOOS == "windows" {
		result = filepath.Join(os.Getenv("USERPROFILE"), ".spicetify")

	} else if runtime.GOOS == "linux" {
		parent, isAvailable := os.LookupEnv("XDG_CONFIG_HOME")

		if !isAvailable || len(parent) == 0 {
			parent = filepath.Join(os.Getenv("HOME"), ".config")
			CheckExistAndCreate(parent)
		}

		result = filepath.Join(parent, "spicetify")

	} else if runtime.GOOS == "darwin" {
		parent := filepath.Join(os.Getenv("HOME"), ".config")
		CheckExistAndCreate(parent)

		result = filepath.Join(parent, "spicetify")
	}

	return result
}

// getUserFolder checks if folder `name` is available in spicetifyFolder,
// else creates then returns the path.
func GetUserFolder(name string) string {
	dir := filepath.Join(GetSpicetifyFolder(), name)
	CheckExistAndCreate(dir)

	return dir
}

var userAppsFolder = GetUserFolder("CustomApps")
var userExtensionsFolder = GetUserFolder("Extensions")

func GetCustomAppPath(name string) (string, error) {
	customAppFolderPath := filepath.Join(userAppsFolder, name)

	if _, err := os.Stat(customAppFolderPath); err == nil {
		return customAppFolderPath, nil
	}

	customAppFolderPath = filepath.Join(GetExecutableDir(), "CustomApps", name)

	if _, err := os.Stat(customAppFolderPath); err == nil {
		return customAppFolderPath, nil
	}

	return "", errors.New("Custom app not found")
}

func GetExtensionPath(name string) (string, error) {
	extFilePath := filepath.Join(userExtensionsFolder, name)

	if _, err := os.Stat(extFilePath); err == nil {
		return extFilePath, nil
	}

	extFilePath = filepath.Join(GetExecutableDir(), "Extensions", name)

	if _, err := os.Stat(extFilePath); err == nil {
		return extFilePath, nil
	}

	return "", errors.New("Extension not found")
}