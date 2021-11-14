package utils

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/go-ini/ini"
)

var (
	configLayout = map[string]map[string]string{
		"Setting": {
			"spotify_path":            "",
			"prefs_path":              "",
			"current_theme":           "",
			"color_scheme":            "",
			"inject_css":              "1",
			"replace_colors":          "1",
			"overwrite_assets":        "0",
			"spotify_launch_flags":    "",
			"check_spicetify_upgrade": "0",
		},
		"Preprocesses": {
			"disable_sentry":        "1",
			"disable_ui_logging":    "1",
			"remove_rtl_rule":       "1",
			"expose_apis":           "1",
			"disable_upgrade_check": "1",
		},
		"AdditionalOptions": {
			"extensions":            "",
			"custom_apps":           "",
			"sidebar_config":        "1",
			"home_config":           "1",
			"experimental_features": "1",
		},
		"Patch": {},
	}
)

type config struct {
	path    string
	content *ini.File
}

// Config .
type Config interface {
	Write()
	GetSection(string) *ini.Section
	GetPath() string
}

// ParseConfig read config file content, return default config
// if file doesn't exist.
func ParseConfig(configPath string) Config {
	cfg, err := ini.LoadSources(
		ini.LoadOptions{
			IgnoreContinuation: true,
		},
		configPath)

	if err != nil {
		defaultConfig := config{
			path:    configPath,
			content: getDefaultConfig(),
		}
		defaultConfig.Write()
		PrintSuccess("Default config-xpui.ini generated.")
		return defaultConfig
	}

	needRewrite := false
	for sectionName, keyList := range configLayout {
		section, err := cfg.GetSection(sectionName)
		if err != nil {
			section, _ = cfg.NewSection(sectionName)
			needRewrite = true
		}
		for keyName, defaultValue := range keyList {
			if _, err := section.GetKey(keyName); err != nil {
				section.NewKey(keyName, defaultValue)
				needRewrite = true
			}
		}
	}

	if needRewrite {
		PrintSuccess("Config is updated.")
		cfg.SaveTo(configPath)
	}

	return config{
		path:    configPath,
		content: cfg,
	}
}

// Write writes content to config file.
func (c config) Write() {
	c.content.SaveTo(c.path)
}

func (c config) GetSection(name string) *ini.Section {
	sec, err := c.content.GetSection(name)

	if err != nil {
		sec, _ = c.content.NewSection(name)
		for keyName, defaultValue := range configLayout[name] {
			sec.NewKey(keyName, defaultValue)
		}
	}

	return sec
}

func (c config) GetPath() string {
	return c.path
}

func getDefaultConfig() *ini.File {
	var cfg = ini.Empty()

	spotifyPath := FindAppPath()
	prefsFilePath := FindPrefFilePath()

	if len(spotifyPath) == 0 {
		PrintError("Could not detect Spotify location.")
	} else {
		configLayout["Setting"]["spotify_path"] = spotifyPath
	}

	if len(prefsFilePath) == 0 {
		PrintError(`Could not detect "prefs" file location.`)
	} else {
		configLayout["Setting"]["prefs_path"] = prefsFilePath
	}

	for sectionName, keyList := range configLayout {
		section, err := cfg.NewSection(sectionName)
		if err != nil {
			panic(err)
		}
		for keyName, defaultValue := range keyList {
			section.NewKey(keyName, defaultValue)
		}
	}

	version, err := cfg.NewSection("Backup")
	if err != nil {
		panic(err)
	}
	version.Comment = "DO NOT CHANGE!"
	version.NewKey("version", "")
	version.NewKey("with", "")
	return cfg
}

// FindAppPath finds Spotify location in various possible places
// of each platform and returns it.
// Returns blank string if none of default locations exists.
func FindAppPath() string {
	switch runtime.GOOS {
	case "windows":
		path := winApp()
		if len(path) == 0 {
			path = winXApp()
		}
		return path

	case "linux":
		return linuxApp()

	case "darwin":
		return darwinApp()
	}

	return ""
}

// FindPrefFilePath finds Spotify "prefs" file location
// in various possible places of each platform and returns it.
// Returns blank string if none of default locations exists.
func FindPrefFilePath() string {
	switch runtime.GOOS {
	case "windows":
		path := winPrefs()
		if len(path) == 0 {
			path = winXPrefs()
		}
		return path

	case "linux":
		return linuxPrefs()

	case "darwin":
		return darwinPrefs()
	}

	return ""
}

func winApp() string {
	path := filepath.Join(os.Getenv("APPDATA"), "Spotify")
	if _, err := os.Stat(path); err == nil {
		return path
	}

	return ""
}

func winPrefs() string {
	path := filepath.Join(os.Getenv("APPDATA"), "Spotify", "prefs")
	if _, err := os.Stat(path); err == nil {
		return path
	}

	return ""
}

func winXApp() string {
	ps, _ := exec.LookPath("powershell.exe")
	cmd := exec.Command(ps,
		"-NoProfile",
		"-NonInteractive",
		`(Get-AppxPackage | Where-Object -Property Name -Eq "SpotifyAB.SpotifyMusic").InstallLocation`)

	stdOut, err := cmd.CombinedOutput()
	if err == nil {
		return strings.TrimSpace(string(stdOut))
	}

	return ""
}

func winXPrefs() string {
	ps, _ := exec.LookPath("powershell.exe")
	cmd := exec.Command(ps,
		"-NoProfile",
		"-NonInteractive",
		`(Get-AppxPackage | Where-Object -Property Name -Match "^SpotifyAB").PackageFamilyName`)

	stdOut, err := cmd.CombinedOutput()
	if err == nil {
		return filepath.Join(
			os.Getenv("LOCALAPPDATA"),
			"Packages",
			strings.TrimSpace(string(stdOut)),
			"LocalState",
			"Spotify",
			"prefs")
	}

	return ""
}

func linuxApp() string {
	path, err := exec.Command("whereis", "-b", "spotify").Output()

	if err == nil {
		pathString := strings.Replace(string(path), "spotify: ", "", 1)
		pathString = strings.Replace(pathString, "\n", "", -1)
		binList := strings.Split(pathString, " ")

		for _, v := range binList {
			bin := v

			stat, err := os.Lstat(bin)
			if err != nil {
				continue
			}

			if (stat.Mode() & os.ModeSymlink) != 0 {
				binDest, err := os.Readlink(v)

				if err != nil {
					continue
				}

				bin = binDest
			}

			bin = filepath.Dir(bin)

			if _, err := os.Stat(filepath.Join(bin, "Apps")); err == nil {
				return bin
			}
		}
	}

	potentialList := []string{
		"/opt/spotify/",
		"/usr/share/spotify/",
		"/var/lib/flatpak/app/com.spotify.Client/x86_64/stable/active/files/extra/share/spotify/",
	}

	for _, v := range potentialList {
		_, err := os.Stat(filepath.Join(v, "Apps"))
		_, err2 := os.Stat(filepath.Join(v, "spotify"))
		if err == nil && err2 == nil {
			return v
		}
	}

	return ""
}

func linuxPrefs() string {
	dotConfig := os.Getenv("XDG_CONFIG_HOME")

	if len(dotConfig) == 0 {
		dotConfig = filepath.Join(os.Getenv("HOME"), ".config")
	}

	pref := filepath.Join(dotConfig, "spotify", "prefs")
	if _, err := os.Stat(pref); err == nil {
		return pref
	}

	return ""
}

func darwinApp() string {
	path := filepath.Join("/Applications", "Spotify.app", "Contents", "Resources")
	if _, err := os.Stat(path); err == nil {
		return path
	}

	return ""
}

func darwinPrefs() string {
	pref := filepath.Join(os.Getenv("HOME"), "Library/Application Support/Spotify/prefs")
	if _, err := os.Stat(pref); err == nil {
		return pref
	}

	return ""
}
