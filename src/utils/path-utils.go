package utils

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

func MigrateConfigFolder() {
	if runtime.GOOS == "windows" {
		source := filepath.Join(os.Getenv("USERPROFILE"), ".spicetify")
		if _, err := os.Stat(source); err == nil {
			spinner, _ := Spinner.Start("Migrating spicetify config folder")
			destination := GetSpicetifyFolder()
			err := Copy(source, destination, true, nil)
			if err != nil {
				spinner.Fail("Failed to migrate spicetify config folder")
				Fatal(err)
			}
			os.RemoveAll(source)
			spinner.Success("Migrated spicetify config folder")
		}
	}
}

func MigrateFolders() {
	backupPath := filepath.Join(GetSpicetifyFolder(), "Backup")
	extractedPath := filepath.Join(GetSpicetifyFolder(), "Extracted")

	if _, err := os.Stat(backupPath); err == nil {
		newBackupPath := GetStateFolder("Backup")
		oldAbs, err := filepath.Abs(backupPath)
		if err != nil {
			Fatal(err)
		}
		newAbs, err := filepath.Abs(newBackupPath)
		if err != nil {
			Fatal(err)
		}

		if oldAbs != newAbs {
			spinner, _ := Spinner.Start("Migrating spicetify backup folder")
			err := Copy(backupPath, newBackupPath, true, nil)
			if err != nil {
				spinner.Fail("Failed to migrate spicetify backup folder")
				Fatal(err)
			}
			os.RemoveAll(backupPath)
			spinner.Success("Migrated spicetify backup folder")
		}
	}

	if _, err := os.Stat(extractedPath); err == nil {
		newExtractedPath := GetStateFolder("Extracted")
		oldAbs, err := filepath.Abs(extractedPath)
		if err != nil {
			Fatal(err)
		}
		newAbs, err := filepath.Abs(newExtractedPath)
		if err != nil {
			Fatal(err)
		}
		if oldAbs != newAbs {
			spinner, _ := Spinner.Start("Migrating spicetify extracted folder")
			err := Copy(extractedPath, newExtractedPath, true, nil)
			if err != nil {
				spinner.Fail("Failed to migrate spicetify extracted folder")
				Fatal(err)
			}
			os.RemoveAll(extractedPath)
			spinner.Success("Migrated spicetify extracted folder")
		}
	}
}

func ReplaceEnvVarsInString(input string) string {
	var replacements []string
	for _, v := range os.Environ() {
		pair := strings.SplitN(v, "=", 2)
		replacements = append(replacements, "$"+pair[0], pair[1])
	}
	replacer := strings.NewReplacer(replacements...)
	return replacer.Replace(input)
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

func GetStateFolder(name string) string {
	result, isAvailable := os.LookupEnv("SPICETIFY_STATE")
	defer func() { CheckExistAndCreate(result) }()

	if isAvailable && len(result) > 0 {
		return result
	}

	if runtime.GOOS == "windows" {
		parent := os.Getenv("APPDATA")

		result = filepath.Join(parent, "spicetify")
	} else if runtime.GOOS == "linux" {
		parent, isAvailable := os.LookupEnv("XDG_STATE_HOME")

		if !isAvailable || len(parent) == 0 {
			parent = filepath.Join(os.Getenv("HOME"), ".local", "state")
			CheckExistAndCreate(parent)
		}

		result = filepath.Join(parent, "spicetify")
	} else if runtime.GOOS == "darwin" {
		parent := filepath.Join(os.Getenv("HOME"), ".local", "state")
		CheckExistAndCreate(parent)

		result = filepath.Join(parent, "spicetify")
	}

	return GetSubFolder(result, name)
}

// GetSubFolder checks if folder `name` is available in specified folder,
// else creates then returns the path.
func GetSubFolder(folder string, name string) string {
	dir := filepath.Join(folder, name)
	CheckExistAndCreate(dir)

	return dir
}

var userAppsFolder = GetSubFolder(GetSpicetifyFolder(), "CustomApps")
var userExtensionsFolder = GetSubFolder(GetSpicetifyFolder(), "Extensions")

func GetCustomAppSubfolderPath(folderPath string) string {
	entries, err := os.ReadDir(folderPath)
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
