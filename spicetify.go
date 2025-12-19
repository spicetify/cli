package main

import (
	"errors"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"sync"

	colorable "github.com/mattn/go-colorable"
	"github.com/pterm/pterm"
	"github.com/spicetify/cli/src/cmd"
	spotifystatus "github.com/spicetify/cli/src/status/spotify"
	"github.com/spicetify/cli/src/utils"
	"github.com/spicetify/cli/src/utils/isAdmin"
)

var (
	version string
)

var (
	flags            = []string{}
	commands         = []string{}
	quiet            = false
	extensionFocus   = false
	appFocus         = false
	styleFocus       = false
	noRestart        = false
	liveRefresh      = false
	bypassAdminCheck = false
)

func init() {
	if runtime.GOOS != "windows" &&
		runtime.GOOS != "darwin" &&
		runtime.GOOS != "linux" {
		utils.PrintError("Unsupported OS.")
		os.Exit(1)
	}
	if version == "" {
		version = "Dev"
	}

	log.SetFlags(0)
	// Supports print color output for Windows
	log.SetOutput(colorable.NewColorableStdout())

	// Separates flags and commands
	for _, v := range os.Args[1:] {
		if len(v) > 0 && v[0] == '-' {
			if len(v) > 2 && v[1] != '-' {
				for _, char := range v[1:] {
					flags = append(flags, "-"+string(char))
				}
			} else {
				flags = append(flags, v)
			}
		} else {
			commands = append(commands, v)
		}
	}

	for _, v := range flags {
		switch v {
		case "--bypass-admin":
			bypassAdminCheck = true
		case "-c", "--config":
			log.Println(cmd.GetConfigPath())
			os.Exit(0)
		case "-h", "--help":
			kind := ""
			if len(commands) > 0 {
				kind = commands[0]
			}
			if kind == "config" {
				helpConfig()
			} else {
				help()
			}

			os.Exit(0)
		case "-v", "--version":
			log.Println(version)
			os.Exit(0)
		case "-e", "--extension":
			extensionFocus = true
			liveRefresh = true
		case "-a", "--app":
			appFocus = true
			liveRefresh = true
		case "-q", "--quiet":
			quiet = true
		case "-n", "--no-restart":
			noRestart = true
		case "-s", "--style":
			styleFocus = true
			liveRefresh = true
		case "-l", "--live-refresh":
			extensionFocus = true
			appFocus = true
			styleFocus = true
			liveRefresh = true
		}
	}

	if quiet {
		log.SetOutput(io.Discard)
		os.Stdout = nil
		pterm.DisableOutput()
	}

	if isAdmin.Check(bypassAdminCheck) {
		utils.PrintError("Spicetify should NOT be run with administrator or root privileges")
		utils.PrintError("Doing so can cause Spotify to show a black/blank window after applying!")
		utils.PrintError("This happens because Spotify (running as a normal user) can't access files modified with admin privileges")
		utils.PrintInfo("If you understand the risks and need to continue, you can use the '--bypass-admin' flag.")
		os.Exit(1)
	}

	for i, flag := range flags {
		if flag == "--bypass-admin" {
			flags = append(flags[:i], flags[i+1:]...)
			break
		}
	}

	utils.MigrateConfigFolder()
	utils.MigrateFolders()
	cmd.InitConfig(quiet)

	if len(commands) < 1 {
		help()
		cmd.CheckUpdate(version)
		os.Exit(0)
	}
}

func main() {
	if slices.Contains(commands, "config-dir") {
		cmd.ShowConfigDirectory()
		return
	}

	// Unchainable commands
	switch commands[0] {
	case "config":
		commands = commands[1:]
		if len(commands) == 0 {
			cmd.DisplayAllConfig()
		} else if len(commands) == 1 {
			cmd.DisplayConfig(commands[0])
		} else {
			cmd.EditConfig(commands)
		}
		return

	case "color":
		commands = commands[1:]
		if len(commands) == 0 {
			cmd.DisplayColors()
		} else {
			cmd.EditColor(commands)
		}
		return

	case "spotify-updates":
		cmd.InitPaths()
		commands = commands[1:]
		if len(commands) == 0 {
			utils.PrintError("No parameter given. It has to be \"block\" or \"unblock\".")
			return
		}
		param := commands[0]
		switch param {
		case "block":
			cmd.BlockSpotifyUpdates(true)
		case "unblock":
			cmd.BlockSpotifyUpdates(false)
		default:
			utils.PrintError("Invalid parameter. It has to be \"block\" or \"unblock\".")
		}
		return

	case "path":
		cmd.InitPaths()
		commands = commands[1:]
		path, err := (func() (string, error) {
			if styleFocus {
				if len(commands) == 0 {
					return cmd.ThemeAllAssetsPath()
				}
				return cmd.ThemeAssetPath(commands[0])
			} else if extensionFocus {
				if len(commands) == 0 {
					return cmd.ExtensionAllPath()
				}
				return cmd.ExtensionPath(commands[0])
			} else if appFocus {
				if len(commands) == 0 {
					return cmd.AppAllPath()
				}
				return cmd.AppPath(commands[0])
			} else {
				for _, v := range flags {
					if v != "-e" && v != "-c" && v != "-a" && v != "-s" {
						return "", errors.New("invalid option\navailable options: -e, -c, -a, -s")
					}
				}

				if len(commands) == 0 && len(flags) == 0 {
					return utils.GetExecutableDir(), nil
				} else if commands[0] == "all" {
					return cmd.AllPaths()
				} else if commands[0] == "userdata" {
					return utils.GetSpicetifyFolder(), nil
				}
				return "", errors.New("invalid option\navailable options: all, userdata")
			}
		})()

		if err != nil {
			utils.Fatal(err)
		}

		log.Println(path)
		return

	case "watch":
		cmd.InitPaths()

		var name []string
		if len(commands) > 1 {
			name = commands[1:]
		}

		var watchGroup sync.WaitGroup

		if extensionFocus {
			watchGroup.Add(1)
			go func(name []string, liveUpdate bool) {
				defer watchGroup.Done()
				cmd.WatchExtensions(name, liveUpdate)
			}(name, liveRefresh)
		}

		if appFocus {
			watchGroup.Add(1)
			go func(name []string, liveUpdate bool) {
				defer watchGroup.Done()
				cmd.WatchCustomApp(name, liveUpdate)
			}(name, liveRefresh)
		}

		if styleFocus {
			watchGroup.Add(1)
			go func(liveUpdate bool) {
				defer watchGroup.Done()
				cmd.Watch(liveUpdate)
			}(liveRefresh)
		}

		watchGroup.Wait()
		return
	}

	cmd.InitPaths()

	utils.PrintBold("spicetify v" + version)
	if slices.Contains(commands, "upgrade") || slices.Contains(commands, "update") {
		updateStatus := cmd.Update(version)
		spotifyPath := filepath.Join(cmd.GetSpotifyPath(), "Apps")
		ex, err := os.Executable()
		if err != nil {
			ex = "spicetify"
		}

		if updateStatus {
			spotStat := spotifystatus.Get(spotifyPath)
			cmds := []string{"backup", "apply"}
			if !spotStat.IsBackupable() {
				cmds = append([]string{"restore"}, cmds...)
			}

			cmd := exec.Command(ex, cmds...)
			utils.CmdScanner(cmd)

			cmd = exec.Command(ex, strings.Join(commands[:], " "))
			utils.CmdScanner(cmd)
		}

		spotStat := spotifystatus.Get(spotifyPath)
		if spotStat.IsBackupable() {
			utils.PrintNote("spicetify is up-to-date! If you ran this because spicetify disappeared after Spotify updated, we'll attempt to fix it for you right now.")
			cmd.Backup(version, true)
			cmd.CheckStates()
			cmd.InitSetting()
			cmd.Apply(version)
			if !noRestart {
				cmd.SpotifyRestart()
			}
		}

		return
	} else {
		cmd.CheckUpdate(version)
	}

	var shouldRestart bool = false
	// Chainable commands
	for _, v := range commands {
		switch v {
		case "backup":
			cmd.Backup(version, slices.Contains(commands, "apply"))

		case "clear":
			cmd.Clear()

		case "apply":
			cmd.CheckStates()
			cmd.InitSetting()
			cmd.Apply(version)
			shouldRestart = true

		case "refresh":
			cmd.CheckStates()
			cmd.InitSetting()
			if extensionFocus {
				cmd.RefreshExtensions()
			} else if appFocus {
				cmd.RefreshApps()
			} else {
				cmd.RefreshTheme()
			}

		case "restore":
			cmd.Restore()
			shouldRestart = true

		case "enable-devtools":
			cmd.EnableDevTools()
			shouldRestart = true

		case "restart":
			cmd.SpotifyRestart()

		case "auto":
			cmd.Auto(version)
			shouldRestart = true

		default:
			utils.Fatal(errors.New(`Command "` + v + `" not found.
Run "spicetify -h" for a list of valid commands.`))
		}
	}

	if !noRestart && !slices.Contains(commands, "restart") && shouldRestart {
		cmd.SpotifyRestart()
	}
}

func help() {
	utils.PrintBold("spicetify v" + version)
	log.Println(utils.Bold("USAGE") + "\n" +
		"spicetify [-q] [-e] [-a] \x1B[4mcommand\033[0m...\n" +
		"spicetify {-c | --config} | {-v | --version} | {-h | --help}\n\n" +
		utils.Bold("DESCRIPTION") + "\n" +
		"Customize Spotify client UI and functionality\n\n" +
		utils.Bold("CHAINABLE COMMANDS") + `
backup              Start backup and preprocessing of app files.

apply               Apply customization.

refresh             Refresh the theme's CSS, JS, colors, and assets.
                    Use with flag "-e" to update extensions or with flag "-a" to update custom apps.

restore             Restore Spotify to original state.

clear               Clear current backup files.

enable-devtools     Enable Spotify's developer tools.
                    Press Ctrl + Shift + I (Windows/Linux) or Cmd + Option + I (macOS) in the Spotify client to open.

watch               Enter watch mode.
                    To update on change, use with any combination of the following flags:
                        "-e" (for extensions),
                        "-a" (for custom apps),
                        "-s" (for the active theme; color.ini, user.css, theme.js, and assets)
                        "-l" (for all of the above)


restart             Restart Spotify client.

` + utils.Bold("NON-CHAINABLE COMMANDS") + `
spotify-updates     Block Spotify updates by patching spotify executable.
                    Accepts "block" or "unblock" as the parameter.

path                Print path of Spotify's executable, userdata, and more.
                    1. Print executable path:
                    spicetify path

                    2. Print userdata path:
                    spicetify path userdata

                    3. Print all paths:
                    spicetify path all

                    4. Toggle focus with flags:
                    spicetify path <flag> <option>

                    Available flags and options:
                    "-e" (for extensions),
                    options: root, extension name, blank for all.

                    "-a" (for custom apps),
                    options: root, <app-name>, blank for all.

                    "-s" (for the active theme)
                    options: root, folder, color, css, js, assets, blank for all.

                    "-c" (for config.ini)
                    options: N/A.

config              1. Print all config fields and values:
                    spicetify config

                    2. Print one config field's value:
                    spicetify config <field>

                    Example usage:
                    spicetify config color_scheme
                    spicetify config custom_apps

                    3. Change value of one or multiple config fields.
                    spicetify config <field> <value> [<field> <value> ...]

                    "extensions" and "custom_apps" fields are arrays of values,
                    so <value> will be appended to those fields' current value.
                    To remove one of array's values, postfix "-" to <value>.

                    Example usage:
                    - Enable "disable_sentry" preprocess:
                    spicetify config disable_sentry 1
                    - Add extension "myFakeExt.js" to current extensions list:
                    spicetify config extensions myFakeExt.js
                    - Remove extension "wrongname.js" from extensions list:
                    spicetify config extensions wrongname.js-
                    - Disable "inject_css" and enable "song_page"
                    spicetify config inject_css 0 song_page 1

color               1. Print all color fields and values.
                    spicetify color

                    Color boxes require 24-bit color (True color) supported
                    terminal to show colors correctly.

                    2. Change theme's one or multiple color values.
                    spicetify color <field> <value> [<field> <value> ...]

                    <value> can be in hex or decimal (rrr,ggg,bbb) format.

                    Example usage:
                    - Change main to ff0000
                    spicetify color main ff0000
                    - Change sidebar to 00ff00 and button to 0000ff
                    spicetify color sidebar 00ff00 button 0000ff

config-dir          Show config directory in file viewer

upgrade|update      Update spicetify to the latest version if an update is available

` + utils.Bold("FLAGS") + `
-q, --quiet         Quiet mode (no output).

-s, --style         Use with "watch" or "path" to focus on the active theme.
                    Use with "watch" to auto-reload Spotify when changes are made to the active theme.

-e, --extension     Use with "refresh", "watch" or "path" to focus on extensions.
                    Use with "watch" to auto-reload Spotify when changes are made to extensions.

-a, --app           Use with "refresh", "watch" or "path" to focus on custom apps.
                    Use with "watch" to auto-reload Spotify when changes are made to apps.

-l, --live-refresh  Use with "watch" command to auto-reload Spotify when changes
                    are made to any custom component.

-n, --no-restart    Do not restart Spotify after running command(s),
                    except for the "restart" command.

--bypass-admin      Bypass admin or root (sudo) check. NOT RECOMMENDED

-c, --config        Print config file path and quit

-h, --help          Print this help text and quit

-v, --version       Print version number and quit

For config information, run "spicetify -h config".
For more information and reporting bugs: https://github.com/spicetify/cli/`)
}

func helpConfig() {
	utils.PrintBold("CONFIG MEANING")
	log.Println(utils.Bold("[Setting]") + `
spotify_path
    Path to Spotify directory

prefs_path
    Path to Spotify's "prefs" file

current_theme
    Name of folder of your theme

color_scheme
    Color config section name in color.ini file.
    If color_scheme is blank, first section in color.ini file would be used.

inject_css <0 | 1>
    Whether custom css from user.css in theme folder is applied

inject_theme_js <0 | 1>
    Whether custom js from theme.js in theme folder is applied

replace_colors <0 | 1>
    Whether custom colors is applied

spotify_launch_flags <string>
    Command-line flags used when launching/restarting Spotify.
    Separate each flag with "|".
    List of valid flags: https://spicetify.app/docs/development/spotify-cli-flags

always_enable_devtools <0 | 1>
    Whether Chrome DevTools is enabled when launching/restarting Spotify.

check_spicetify_update <0 | 1>
    Whether to always check for updates when running Spicetify.

` + utils.Bold("[Preprocesses]") + `
disable_sentry <0 | 1>
    Prevents Sentry and Amazon Qualaroo to send console log/error/warning to Spotify developers.
    Enable if you don't want to catch their attention when developing extension or app.

disable_ui_logging <0 | 1>
    Various elements logs every user clicks, scrolls.
    Enable to stop logging and improve user experience.

remove_rtl_rule <0 | 1>
    To support Arabic and other Right-To-Left language, Spotify added a lot of
    CSS rules that are obsoleted to Left-To-Right users.
    Enable to remove all of them and improve render speed.

expose_apis <0 | 1>
    Leaks some Spotify's API, functions, objects to Spicetify global object that
    are useful for making extensions to extend Spotify functionality.

` + utils.Bold("[AdditionalOptions]") + `
custom_apps <string>
    List of custom apps. Separate each app with "|".

extensions <string>
    List of Javascript files to be executed along with Spotify main script.
    Separate each extension with "|".

experimental_features <0 | 1>
    Enable ability to activate unfinished or work-in-progress features that would eventually be released in future Spotify updates.
    Open "Experimental features" popup in Profile menu.

home_config <0 | 1>
    Enable ability to re-arrange sections in Home page.
    Navigate to Home page, turn "Home config" mode on in Profile menu and hover on sections to show customization buttons.

sidebar_config <0 | 1>
    Enable ability to stick, hide, re-arrange sidebar items.
    Turn "Sidebar config" mode on in Profile menu and hover on sidebar items to show customization buttons.

` + utils.Bold("[Patch]") + `
Allows you to apply custom patches to Spotify.`)
}
