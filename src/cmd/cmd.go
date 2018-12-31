package cmd

import (
	"os"
	"path/filepath"
	"runtime"

	"github.com/go-ini/ini"
	"github.com/khanhas/spicetify-cli/src/utils"
)

var (
	spicetifyFolder         = getSpicetifyFolder()
	rawFolder, themedFolder = getExtractFolder()
	backupFolder            = getBackupFolder()
	quiet                   bool
	spotifyPath             string
	prefsPath               string
	cfg                     utils.Config
	settingSection          *ini.Section
	backupSection           *ini.Section
	featureSection          *ini.Section
)

// Init .
func Init(isQuiet bool) {
	quiet = isQuiet

	cfg = utils.ParseConfig(GetConfigPath())
	settingSection = cfg.GetSection("Setting")
	backupSection = cfg.GetSection("Backup")
	featureSection = cfg.GetSection("AdditionalOptions")

	spotifyPath = settingSection.Key("spotify_path").String()

	if len(spotifyPath) != 0 {
		if _, err := os.Stat(spotifyPath); err != nil {
			utils.PrintError(spotifyPath + ` does not exist or is not a valid path. Please manually set "spotify_path" in config.ini to correct directory of Spotify.`)
			os.Exit(1)
		}
	} else if spotifyPath = utils.FindAppPath(); len(spotifyPath) != 0 {
		settingSection.Key("spotify_path").SetValue(spotifyPath)
		cfg.Write()
	} else {
		utils.PrintError(`Cannot detect Spotify location. Please manually set "spotify_path" in config.ini`)
		os.Exit(1)
	}

	prefsPath = settingSection.Key("prefs_path").String()

	if len(prefsPath) != 0 {
		if _, err := os.Stat(prefsPath); err != nil {
			utils.PrintError(prefsPath + ` does not exist or is not a valid path. Please manually set "prefs_path" in config.ini to correct path of "prefs" file.`)
			os.Exit(1)
		}
	} else if prefsPath = utils.FindPrefFilePath(); len(prefsPath) != 0 {
		settingSection.Key("prefs_path").SetValue(prefsPath)
		cfg.Write()
	} else {
		utils.PrintError(`Cannot detect Spotify "prefs" file location. Please manually set "prefs_path" in config.ini`)
		os.Exit(1)
	}
}

// GetConfigPath .
func GetConfigPath() string {
	return filepath.Join(spicetifyFolder, "config.ini")
}

// GetSpotifyPath .
func GetSpotifyPath() string {
	return spotifyPath
}

func getSpicetifyFolder() string {
	result := "/"
	if runtime.GOOS == "windows" {
		result = filepath.Join(os.Getenv("USERPROFILE"), ".spicetify")
	} else if runtime.GOOS == "linux" {
		result = filepath.Join(os.Getenv("HOME"), ".spicetify")
	} else if runtime.GOOS == "darwin" {
		result = filepath.Join(os.Getenv("HOME"), "spicetify_data")
	}

	utils.CheckExistAndCreate(result)

	return result
}

func getBackupFolder() string {
	dir := filepath.Join(spicetifyFolder, "Backup")
	utils.CheckExistAndCreate(dir)

	return dir
}

func getExtractFolder() (string, string) {
	dir := filepath.Join(spicetifyFolder, "Extracted")
	utils.CheckExistAndCreate(dir)

	raw := filepath.Join(dir, "Raw")
	utils.CheckExistAndCreate(raw)

	themed := filepath.Join(dir, "Themed")
	utils.CheckExistAndCreate(themed)

	return raw, themed
}

func getThemeFolder(themeName string) string {
	folder := filepath.Join(spicetifyFolder, "Themes", themeName)
	_, err := os.Stat(folder)
	if err == nil {
		return folder
	}

	folder = filepath.Join(utils.GetExecutableDir(), "Themes", themeName)
	_, err = os.Stat(folder)
	if err == nil {
		return folder
	}

	utils.PrintError(`Theme "` + themeName + `" not found`)
	os.Exit(1)
	return ""
}
