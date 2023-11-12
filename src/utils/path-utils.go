package utils

import (
	"errors"
	"io/ioutil"
	"os"
	"path/filepath"
	"runtime"
)

func MigrateConfigFolder() {
	if runtime.GOOS == "windows" {
		source := filepath.Join(os.Getenv("USERPROFILE"), ".spicetify")
		if _, err := os.Stat(source); err == nil {
			PrintBold("Migrating spicetify config folder")
			destination := GetSpicetifyFolder()
			err := Copy(source, destination, true, nil)
			if err != nil {
				Fatal(err)
			}
			os.RemoveAll(source)
			PrintGreen("OK")
		}
	}
}

func GetSpicetifyFolder() string {
	result, isAvailable := os.LookupEnv("SPICETIFY_CONFIG")
	defer func() { CheckExistAndCreate(result) }()

	if isAvailable && len(result) > 0 {
		return result
	}

	if runtime.GOOS == "windows" {
		parent := os.Getenv("APPDATA")

		result = filepath.Join(parent, "spicetify")
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

func GetCustomAppSubfolderPath(folderPath string) string {
	entries, err := ioutil.ReadDir(folderPath)
	if err != nil {
		return ""
	}

	for _, entry := range entries {
		if entry.IsDir() {
			subfolderPath := filepath.Join(folderPath, entry.Name())
			indexPath := filepath.Join(subfolderPath, "index.js")

			if _, err := os.Stat(indexPath); err == nil {
				return subfolderPath
			}

			if subfolderPath := GetCustomAppSubfolderPath(subfolderPath); subfolderPath != "" {
				return subfolderPath
			}
		}
	}

	return ""
}

func GetCustomAppPath(name string) (string, error) {
	customAppFolderPath := filepath.Join(userAppsFolder, name)

	if _, err := os.Stat(customAppFolderPath); err == nil {
		customAppActualFolderPath := GetCustomAppSubfolderPath(customAppFolderPath)
		if customAppActualFolderPath != "" {
			return customAppActualFolderPath, nil
		}
		return customAppFolderPath, nil
	}

	customAppFolderPath = filepath.Join(GetExecutableDir(), "CustomApps", name)

	if _, err := os.Stat(customAppFolderPath); err == nil {
		customAppActualFolderPath := GetCustomAppSubfolderPath(customAppFolderPath)
		if customAppActualFolderPath != "" {
			return customAppActualFolderPath, nil
		}
		return customAppFolderPath, nil
	}

	return "", errors.New("custom app not found")
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

	return "", errors.New("extension not found")
}
