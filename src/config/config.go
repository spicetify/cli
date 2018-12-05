package config

import (
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"

	"github.com/go-ini/ini"
)

// ParseConfig read config file content, return default config
// if file doesn't exist.
func ParseConfig(configPath string) *ini.File {
	cfg, err := ini.LoadSources(
		ini.LoadOptions{
			IgnoreContinuation: true,
		},
		configPath)

	if err != nil {
		defaultConfig := getDefaultConfig()
		WriteConfig(defaultConfig, configPath)
		fmt.Println("Default config generated!")
		return defaultConfig
	}

	return cfg
}

// WriteConfig writes content to config file.
func WriteConfig(content *ini.File, configPath string) {
	content.SaveTo(configPath)
}

func getDefaultConfig() *ini.File {
	var cfg = ini.Empty()
	setting, err := cfg.NewSection("Setting")
	if err != nil {
		panic(err)
	}

	var defaultSpotifyPath string
	if runtime.GOOS == "windows" {
		defaultSpotifyPath = filepath.Join(os.Getenv("APPDATA"), "Spotify")
	} else if runtime.GOOS == "linux" {
		defaultSpotifyPath = filepath.Join("/usr", "share", "spotify")
	} else if runtime.GOOS == "darwin" {
		defaultSpotifyPath = filepath.Join("/Applications", "Spotify.app", "Contents", "Resources")
	} else {
		log.Fatal(errors.New("Unsupported OS"))
	}

	setting.NewKey("spotify_path", defaultSpotifyPath)
	setting.NewKey("current_theme", "SpicetifyDefault")
	setting.NewKey("inject_css", "1")
	setting.NewKey("replace_colors", "1")

	preProc, err := cfg.NewSection("Preprocesses")
	if err != nil {
		panic(err)
	}

	preProc.NewKey("disable_sentry", "1")
	preProc.NewKey("disable_ui_logging", "1")
	preProc.NewKey("remove_rtl_rule", "1")
	preProc.NewKey("expose_apis", "1")

	feature, err := cfg.NewSection("AdditionalOptions")
	if err != nil {
		panic(err)
	}

	feature.NewKey("experimental_features", "0")
	feature.NewKey("fastUser_switching", "0")
	feature.NewKey("home", "0")
	feature.NewKey("lyric_always_show", "0")
	feature.NewKey("lyric_force_no_sync", "0")
	feature.NewKey("made_for_you_hub", "0")
	feature.NewKey("radio", "0")
	feature.NewKey("song_page", "0")
	feature.NewKey("visualization_high_framerate", "0")

	version, err := cfg.NewSection("Backup")
	if err != nil {
		panic(err)
	}
	version.Comment = "DO NOT CHANGE!"
	version.NewKey("version", "")
	return cfg
}
