package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"runtime"

	"github.com/go-ini/ini"

	"./backup"
	"./color"
	"./config"
	"./preprocess"
	backupStatus "./status/backup"
	spotifyStatus "./status/spotify"
	"./utils"
	"gopkg.in/mattn/go-colorable.v0"
)

const (
	version = "0.1.0"
)

var (
	spicetifyFolder         = getSpicetifyFolder()
	cfgFilePath             = getConfigFilePath()
	backupFolder            = getBackupFolder()
	rawFolder, themedFolder = getExtractFolder()
)

func init() {
	log.SetOutput(colorable.NewColorableStdout())
	log.SetFlags(0)
}

func main() {
	args := os.Args

	var cfg = config.ParseConfig(cfgFilePath)

	if len(args) < 2 {
		help()
		return
	}

	settingSec, err := cfg.GetSection("Setting")

	if err != nil {
		log.Fatal(err)
	}

	spotifyPath := settingSec.Key("spotify_path").MustString("")
	if len(spotifyPath) == 0 {
		utils.PrintColor("red", true, "Please set spotify_path in config.ini")
		os.Exit(1)
	}

	backupCfgSection, err := cfg.GetSection("Backup")
	backupVersion := backupCfgSection.Key("version").MustString("")
	curBackupStatus := utils.GetBackupStatus(spotifyPath, backupFolder, backupVersion)

	switch args[1] {
	case "backup":
		if err != nil {
			log.Fatal(err)
		}

		if curBackupStatus != backupStatus.EMPTY {
			utils.PrintColor("red", true, "There is available backup, clear current backup first!")
			clearBackup(backupFolder, rawFolder, themedFolder)
			backupCfgSection.Key("version").SetValue("")
			cfg.SaveTo(cfgFilePath)
		}

		utils.PrintBold("Backing up app files:")

		if err = backup.Start(spotifyPath, backupFolder); err != nil {
			log.Fatal(err)
		}
		utils.PrintColor("green", false, "✔")

		appList, err := ioutil.ReadDir(backupFolder)
		if err != nil {
			log.Fatal(err)
		}

		utils.PrintBold("Extracting:")
		tracker := utils.NewTracker(len(appList))
		defer tracker.Finish()

		backup.Extract(backupFolder, rawFolder, func(appName string, err error) {
			tracker.Increment()
			tracker.Set("appName", appName)
		})
		tracker.Set("appName", "✔")
		tracker.Finish()

		preprocSec, err := cfg.GetSection("Preprocesses")
		if err != nil {
			log.Fatal(err)
		}

		tracker = utils.NewTracker(len(appList))

		utils.PrintBold("Preprocessing:")

		preprocess.Start(
			rawFolder,
			preprocess.Flag{
				DisableSentry:  preprocSec.Key("disable_sentry").MustInt(0) == 1,
				DisableLogging: preprocSec.Key("disable_ui_logging").MustInt(0) == 1,
				RemoveRTL:      preprocSec.Key("remove_rtl_rule").MustInt(0) == 1,
				ExposeAPIs:     preprocSec.Key("expose_apis").MustInt(0) == 1},
			func(appName string, err error) {
				tracker.Increment()
				tracker.Set("appName", appName)
			})

		tracker.Set("appName", "✔")
		tracker.Finish()

		utils.RunCopy(rawFolder, themedFolder, true, []string{"*.html", "*.js", "*.css"})

		tracker = utils.NewTracker(len(appList))

		preprocess.StartCSS(themedFolder, func(appName string, err error) {
			tracker.Increment()
			tracker.Set("appName", appName)
		})

		tracker.Set("appName", "✔")
		tracker.Finish()

		backupCfgSection.Key("version").SetValue(utils.GetSpotifyVersion(spotifyPath))
		cfg.SaveTo(cfgFilePath)
		utils.PrintColor("green", true, "Everything is ready, you can start applying now!")

	case "clear":
		clearBackup(backupFolder, rawFolder, themedFolder)
		backupCfgSection.Key("version").SetValue("")
		cfg.SaveTo(cfgFilePath)

	case "apply":
		appFolder := filepath.Join(spotifyPath, "Apps")
		curSpotifyStatus := utils.GetSpotifyStatus(spotifyPath)
		if curSpotifyStatus == spotifyStatus.STOCK {
			os.RemoveAll(appFolder)
			utils.RunCopy(rawFolder, appFolder, true, []string{})
		}

		replaceColors := settingSec.Key("replace_colors").MustInt(0) == 1
		if replaceColors {
			utils.RunCopy(themedFolder, appFolder, true, []string{})
		} else {
			utils.RunCopy(rawFolder, appFolder, true, []string{})
		}

		themeName, err := settingSec.GetKey("current_theme")

		if err != nil {
			log.Fatal(err)
		}

		themeFolder, err := getThemeFolder(themeName.MustString("SpicetifyDefault"))
		if err != nil {
			log.Fatal(err)
		}

		var userCSS string

		if replaceColors {
			userCSS += getColorCSS(themeFolder)
		} else {
			userCSS += getColorCSS("")
		}

		if settingSec.Key("inject_css").MustInt(0) == 1 {
			userCSS += getUserCSS(themeFolder)
		}

		userCSSDestPath := filepath.Join(appFolder, "zlink", "css", "user.css")
		ioutil.WriteFile(userCSSDestPath, []byte(userCSS), 0644)
		userCSSDestPath = filepath.Join(appFolder, "login", "css", "user.css")
		ioutil.WriteFile(userCSSDestPath, []byte(userCSS), 0644)
	case "restore":
		appFolder := filepath.Join(spotifyPath, "Apps")
		status := utils.GetSpotifyStatus(spotifyPath)
		if status == spotifyStatus.APPLIED {
			os.RemoveAll(appFolder)
			utils.RunCopy(backupFolder, appFolder, false, []string{"*.spa"})
		}

	case "enable-devtool":
		utils.SetDevTool(spotifyPath, true)
		utils.PrintBold("DevTool enabled! Restart your Spotify client.")
	case "disable-devtool":
		utils.SetDevTool(spotifyPath, false)
		utils.PrintBold("DevTool disabled! Restart your Spotify client.")
	case "-c", "--config":
		log.Print(getConfigFilePath())
	case "-h", "--help":
		help()
	case "-v", "--version":
		fmt.Print(version)
	}
	return
}

func help() {
	fmt.Print(`
SYNOPSIS
spicetify <command>

DESCRIPTION
Customize Spotify client UI and functionality

COMMANDS
backup              Start backup and preprocessing app files.
apply               Apply customization.
restore             Restore Spotify to original state.
clear               Clear current backup files.
enable-devtool      Enable developer tools (Console, Inspect Elements, ...) of Spotify client,
                    Hit Ctrl + Shift + I in the client to start using.
disable-devtool     Disable developer tools of Spotify client.
-c, --config        Print config file path
-h, --help          Print this help text
-v, --version       Print version number and quit
`)
}

func getSpicetifyFolder() string {
	home := "/"
	if runtime.GOOS == "windows" {
		home = os.Getenv("USERPROFILE")
	} else if runtime.GOOS == "linux" || runtime.GOOS == "darwin" {
		home = os.Getenv("HOME")
	}

	result := filepath.Join(home, ".spicetify")
	_, err := os.Stat(result)
	if err != nil {
		os.Mkdir(result, 0644)
	}

	return result
}

func getConfigFilePath() string {
	return filepath.Join(spicetifyFolder, "config.ini")
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

func clearBackup(backupFolder, rawFolder, themedFolder string) {
	if !utils.ReadAnswer("Before clearing backup, make sure you have restored or re-installed Spotify to original state. Continue? [y/N]: ", false) {
		os.Exit(1)
	}

	os.RemoveAll(backupFolder)
	os.RemoveAll(rawFolder)
	os.RemoveAll(themedFolder)
}

func getThemeFolder(themeName string) (string, error) {
	folder := filepath.Join(spicetifyFolder, "Themes", themeName)
	_, err := os.Stat(folder)
	if err == nil {
		return folder, nil
	}

	folder = filepath.Join(utils.GetExecutableDir(), "Themes", themeName)
	_, err = os.Stat(folder)
	if err == nil {
		return folder, nil
	}

	return "", err
}

func getUserCSS(themeFolder string) string {
	cssFilePath := filepath.Join(themeFolder, "user.css")
	_, err := os.Stat(cssFilePath)

	if err != nil {
		return ""
	}

	content, err := ioutil.ReadFile(cssFilePath)
	if err != nil {
		return ""
	}

	return string(content)
}

// Color names list and their default values
var baseColorList = map[string]string{
	"main_fg":                               "ffffff",
	"secondary_fg":                          "c0c0c0",
	"main_bg":                               "282828",
	"sidebar_and_player_bg":                 "000000",
	"cover_overlay_and_shadow":              "000000",
	"indicator_fg_and_button_bg":            "1db954",
	"pressing_fg":                           "cdcdcd",
	"slider_bg":                             "404040",
	"sidebar_indicator_and_hover_button_bg": "1ed660",
	"scrollbar_fg_and_selected_row_bg":      "333333",
	"pressing_button_fg":                    "cccccc",
	"pressing_button_bg":                    "179443",
	"selected_button":                       "18ac4d",
	"miscellaneous_bg":                      "4687d6",
	"miscellaneous_hover_bg":                "2e77d0",
	"preserve_1":                            "ffffff",
}

func getColorCSS(themeFolder string) string {
	var colorCfg *ini.File
	var err error

	if len(themeFolder) == 0 {
		colorCfg = ini.Empty()
	} else {
		colorFilePath := filepath.Join(themeFolder, "color.ini")
		if colorCfg, err = ini.Load(colorFilePath); err != nil {
			colorCfg = ini.Empty()
		}
	}

	base := colorCfg.Section("Base")

	var variableList string

	for k, v := range baseColorList {
		parsed := color.Parse(base.Key(k).MustString(v))
		variableList += fmt.Sprintf(`
    --modspotify_%s: #%s;
    --modspotify_rgb_%s: %s;`,
			k, parsed.Hex,
			k, parsed.RGB)
	}

	more, err := colorCfg.GetSection("More")

	if err == nil {
		for _, v := range more.KeyStrings() {
			parsed := color.Parse(more.Key(v).MustString("ffffff"))
			variableList += fmt.Sprintf(`
    --modspotify_more_%s: #%s;
    --modspotify_more_rgb_%s: %s;`,
				v, parsed.Hex,
				v, parsed.RGB)
		}
	}

	return fmt.Sprintf(":root {%s\n}\n", variableList)
}
