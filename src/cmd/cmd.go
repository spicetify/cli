package cmd

import (
	"os"
	"path/filepath"
	"runtime"

	"../utils"
	"github.com/go-ini/ini"
)

var (
	spicetifyFolder         = getSpicetifyFolder()
	rawFolder, themedFolder = getExtractFolder()
	backupFolder            = getBackupFolder()
	quiet                   bool
	spotifyPath             string
	cfg                     utils.Config
	settingSection          *ini.Section
	backupSection           *ini.Section
	featureSection          *ini.Section
)

// Init .
func Init(isQuiet bool) {
	quiet = isQuiet

	cfg = utils.ParseConfig(filepath.Join(spicetifyFolder, "config.ini"))
	settingSection = cfg.GetSection("Setting")
	backupSection = cfg.GetSection("Backup")
	featureSection = cfg.GetSection("AdditionalOptions")

	spotifyPath = settingSection.Key("spotify_path").String()

	if len(spotifyPath) == 0 {
		utils.PrintError(`Please set "spotify_path" in config.ini`)
		os.Exit(1)
	}

	if _, err := os.Stat(spotifyPath); err != nil {
		utils.PrintError(spotifyPath + ` does not exist or is not a valid path. Please set "spotify_path" in config.ini to correct directory of Spotify.`)
		os.Exit(1)
	}
}

// GetConfigPath .
func GetConfigPath() string {
	return cfg.GetPath()
}

// GetSpotifyPath .
func GetSpotifyPath() string {
	return spotifyPath
}

func getSpicetifyFolder() string {
	home := "/"
	if runtime.GOOS == "windows" {
		home = os.Getenv("USERPROFILE")
	} else if runtime.GOOS == "linux" || runtime.GOOS == "darwin" {
		home = os.Getenv("HOME")
	}

	result := filepath.Join(home, ".spicetify")
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
