package main

import (
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"

	colorable "github.com/mattn/go-colorable"
	"github.com/spicetify/spicetify-cli/src/cmd"
	spotifystatus "github.com/spicetify/spicetify-cli/src/status/spotify"
	"github.com/spicetify/spicetify-cli/src/utils"
)

var (
	version string
)

var (
	flags          = []string{}
	commands       = []string{}
	quiet          = false
	extensionFocus = false
	appFocus       = false
	styleFocus     = false
	noRestart      = false
	liveUpdate     = false
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
		if v[0] == '-' && v != "-1" {
			if v[1] != '-' && len(v) > 2 {
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
		case "-c", "--config":
			fmt.Println(cmd.GetConfigPath())
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
			fmt.Println(version)
			os.Exit(0)
		case "-e", "--extension":
			extensionFocus = true
			liveUpdate = true
		case "-a", "--app":
			appFocus = true
			liveUpdate = true
		case "-q", "--quiet":
			quiet = true
		case "-n", "--no-restart":
			noRestart = true
		case "-s", "--style":
			styleFocus = true
			liveUpdate = true
		case "-l", "--live-update":
			extensionFocus = true
			appFocus = true
			styleFocus = true
			liveUpdate = true
		case "--check-update":
			upgradeStatus := cmd.Upgrade(version)
			if upgradeStatus {
				ex, err := os.Executable()
				if err != nil {
					ex = "spicetify"
				}

				spotStat := spotifystatus.Get(utils.FindAppPath())
				cmds := []string{"backup", "apply"}
				if !spotStat.IsBackupable() {
					cmds = append([]string{"restore"}, cmds...)
				}

				cmd := exec.Command(ex, cmds...)
				utils.CmdScanner(cmd)

				cmd = exec.Command(ex, strings.Join(commands[:], " "))
				utils.CmdScanner(cmd)

				os.Exit(0)
			}
		}
	}

	if quiet {
		log.SetOutput(io.Discard)
		os.Stdout = nil
	}

	utils.MigrateConfigFolder()
	cmd.InitConfig(quiet)

	if len(commands) < 1 {
		help()
		os.Exit(0)
	}
}

func main() {
	// Show config directory without needing to initialize config
	switch commands[0] {
	case "config-dir":
		cmd.ShowConfigDirectory()
		return
	}

	cmd.InitPaths()

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

	case "path":
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
				if len(flags) != 0 {
					for _, v := range flags {
						if v != "-e" && v != "-c" && v != "-a" && v != "-s" {
							return "", errors.New("invalid option\navailable options: -e, -c, -a, -s")
						}
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

	case "upgrade":
		cmd.Upgrade(version)
		return

	case "watch":
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
			}(name, liveUpdate)
		}

		if appFocus {
			watchGroup.Add(1)
			go func(name []string, liveUpdate bool) {
				defer watchGroup.Done()
				cmd.WatchCustomApp(name, liveUpdate)
			}(name, liveUpdate)
		}

		if styleFocus {
			watchGroup.Add(1)
			go func(liveUpdate bool) {
				defer watchGroup.Done()
				cmd.Watch(liveUpdate)
			}(liveUpdate)
		}

		watchGroup.Wait()
		return
	}

	utils.PrintBold("spicetify v" + version)
	cmd.CheckUpgrade(version)

	// Chainable commands
	for _, v := range commands {
		switch v {
		case "backup":
			cmd.Backup(version)

		case "clear":
			cmd.Clear()

		case "apply":
			cmd.Apply(version)
			restartSpotify()

		case "update":
			if extensionFocus {
				cmd.UpdateAllExtension()
			} else {
				cmd.UpdateTheme()
			}

		case "restore":
			cmd.Restore()
			restartSpotify()

		case "enable-devtools":
			cmd.SetDevTools()
			cmd.EvalSpotifyRestart(true)

		case "restart":
			cmd.EvalSpotifyRestart(false)

		case "auto":
			cmd.Auto(version)
			cmd.EvalSpotifyRestart(true)

		default:
			utils.PrintError(`Command "` + v + `" not found.`)
			utils.PrintInfo(`Run "spicetify -h" for list of valid commands.`)
			os.Exit(1)
		}
	}
}

func restartSpotify() {
	if !noRestart {
		cmd.EvalSpotifyRestart(false)
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
backup              Start backup and preprocessing app files.

apply               Apply customization.

update              By default, updates theme's CSS, JS, colors, and assets.
                    Use with flag "-e" to update extensions.

restore             Restore Spotify to original state.

clear               Clear current backup files.

enable-devtools     Enable Spotify's developer tools.
                    Press Ctrl + Shift + I (Windows/Linux) or Cmd + Option + I (macOS) in the Spotify client to start using.

watch               Enter watch mode.
                    To update on change, use with any combination of the following flags:
                        "-e" (for extensions),
                        "-a" (for custom apps),
                        "-s" (for the active theme; color.ini, user.css, theme.js, and assets)
                        "-l" (for extensions, custom apps, and active theme)


restart             Restart Spotify client.

` + utils.Bold("NON-CHAINABLE COMMANDS") + `
path                Prints path of Spotify's executable, userdata, and more.
                    1. Print executable path:
                    spicetify path

                    2. Print userdata path:
                    spicetify path userdata

                    3. Print all paths:
                    spicetify path all

                    4. Toggle focus with flags:
                    spicetify path <flag> <option>
	
                    Available Flags and Options:
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

config-dir          Shows config directory in file viewer

upgrade             Upgrade spicetify latest version

` + utils.Bold("FLAGS") + `
-q, --quiet         Quiet mode (no output). Be careful, dangerous operations
                    like clear backup, restore will proceed without prompting
                    permission.

-s, --style         Use with "watch" command to auto-reload Spotify when changes are made to the active theme (color.ini, user.css, theme.js, assets).

-e, --extension     Use with "update", "watch" or "path" command to
                    focus on extensions. Use with "watch" command to auto-reload Spotify when changes are made to extensions.

-a, --app           Use with "watch" or "path" to focus on custom apps. Use with "watch" command to auto-reload Spotify when changes are made to apps.

-n, --no-restart    Do not restart Spotify after running command(s), except
                    "restart" command.

-l, --live-update   Use with "watch" command to auto-reload Spotify when changes are made to any custom component (color.ini, user.css, extensions, apps).

-c, --config        Print config file path and quit

-h, --help          Print this help text and quit

-v, --version       Print version number and quit

When using the "watch" command, any combination of the style (-s), extension (-e), and app (-a) flags can be used (ex. "watch -s -e" or "watch -e -a").
For config information, run "spicetify -h config".
For more information and bug report: https://github.com/spicetify/spicetify-cli/`)
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

spotify_launch_flags
    Command-line flags used when launching/restarting Spotify.
    Separate each flag with "|".
    List of valid flags: https://spicetify.app/docs/development/spotify-cli-flags

always_enable_devtools <0 | 1>
    Whether Chrome DevTools is enabled when launching/restarting Spotify.

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

disable_upgrade_check <0 | 1>
    Prevent Spotify checking new version and visually notifying user.
    [Windows] Note: Automatic update still works if you don't manually delete "SpotifyMigrator.exe" and "SpotifyUpdate.exe".

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
    Turn "Sidebar config" mode on in Profile menu and hover on sidebar items to show customization buttons.`)
}
