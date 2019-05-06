package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"runtime"

	"github.com/khanhas/spicetify-cli/src/cmd"
	"github.com/khanhas/spicetify-cli/src/utils"
	colorable "gopkg.in/mattn/go-colorable.v0"
)

const (
	version = "0.7.0"
)

var (
	flags          = []string{}
	commands       = []string{}
	quiet          = false
	extensionFocus = false
	appFocus       = false
)

func init() {
	if runtime.GOOS != "windows" &&
		runtime.GOOS != "darwin" &&
		runtime.GOOS != "linux" {
		utils.PrintError("Unsupported OS.")
		os.Exit(1)
	}

	log.SetFlags(0)
	// Supports print color output for Windows
	log.SetOutput(colorable.NewColorableStdout())

	// Separates flags and commands
	for _, v := range os.Args[1:] {
		if v[0] == '-' {
			flags = append(flags, v)
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
			if len(commands) > 1 {
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
		case "-a", "--app":
			appFocus = true
		case "-q", "--quite":
			quiet = true
		}
	}

	if quiet {
		log.SetOutput(ioutil.Discard)
	}

	cmd.InitConfig(quiet)

	if len(commands) < 1 {
		utils.PrintInfo(`Run "spicetify -h" for commands list.`)
		os.Exit(0)
	}
}

func main() {
	// Non-chainable commands
	switch commands[0] {
	case "config":
		cmd.EditConfig(commands[1:])
		return
	case "color":
		cmd.EditColor(commands[1:])
		return

	case "path":
		path, err := (func() (string, error) {
			if extensionFocus {
				return cmd.ExtensionPath(commands[1])
			} else if appFocus {
				return cmd.AppPath(commands[1])
			} else {
				return cmd.ThemeAssetPath(commands[1])
			}
		})()

		if err != nil {
			utils.Fatal(err)
		}

		log.Println(path)
		return
	}

	utils.PrintBold("spicetify v" + version)

	cmd.InitPaths()

	// Chainable commands
	for _, v := range commands {
		switch v {
		case "backup":
			cmd.Backup()

		case "clear":
			cmd.Clear()

		case "apply":
			cmd.Apply()

		case "update":
			if extensionFocus {
				cmd.UpdateAllExtension()
			} else {
				cmd.UpdateCSS()
			}

		case "restore":
			cmd.Restore()

		case "enable-devtool":
			cmd.SetDevTool(true)

		case "disable-devtool":
			cmd.SetDevTool(false)

		case "watch":
			if extensionFocus {
				cmd.WatchExtensions()
			} else {
				cmd.Watch()
			}

		case "restart":
			cmd.RestartSpotify()

		default:
			utils.PrintError(`Command "` + v + `" not found.`)
			utils.PrintInfo(`Run "spicetify -h" for list of valid commands.`)
			os.Exit(1)
		}
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

update              On default, update theme CSS and colors.
                    Use with flag "-e" to update extensions.

restore             Restore Spotify to original state.

clear               Clear current backup files.

enable-devtool      Enable Spotify's developer tools.
                    Hit Ctrl + Shift + I in the client to start using.

disable-devtool     Disable Spotify's developer tools.

watch               Enter watch mode.
                    On default, update CSS on color.ini or user.css's changes.
                    Use with flag "-e" to update extentions on changes.

restart             Restart Spotify client.

` + utils.Bold("NON-CHAINABLE COMMANDS") + `
path                Print path of color, css, extension file or
                    custom app directory and quit.
` + "                    \x1B[4mUsage:\033[0m" + `
                    - Print theme's color.inc path:
                    spicetify path color
                    - Print theme's user.css path:
                    spicetify path css
                    - Print theme's assets path:
                    spicetify path assets
                    - Print extension <name> path:
                    spicetify -e path <name>
                    - Print custom app <name> path:
                    spicetify -a path <name>

config              Change value of one or multiple config fields. Require at
                    least one pair of "FIELD" "VALUE".
                    "extensions" and "custom_apps" fields are arrays of values,
                    so "VALUE" will be appended to those fields' current value.
                    Example usage:
                    - Enable "disable_sentry" preprocess:
                    spicetify config disable_sentry 1
                    - Add extension "myFakeExt.js" to current extensions list:
                    spicetify config extensions myFakeExt.js
                    - Disable "inject_css" and enable "song_page"
                    spicetify config inject_css 0 song_page 1

color               Change theme's one or multiple color value. Require at
                    least one pair of "FIELD" "VALUE".
                    "VALUE" can be in hex or decimal (rrr,ggg,bbb) format.
                    Example usage:
                    - Change main_bg to ff0000
                    spicetify color main_bg ff0000
                    - Change slider_bg to 00ff00 and pressing_fg to 0000ff
                    spicetify color slider_bg 00ff00 pressing_fg 0000ff

` + utils.Bold("FLAGS") + `
-q, --quiet         Quiet mode (no output). Be careful, dangerous operations
                    like clear backup, restore will proceed without prompting
                    permission.

-e, --extension     Use with "update", "watch" or "path" command to
                    focus on extensions.

-a, --app           Use with "path" to focus on custom apps.

-c, --config        Print config file path and quit

-h, --help          Print this help text and quit

-v, --version       Print version number and quit

For config information, run "spicetify -h config".`)
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

inject_css
    Whether custom css from user.css in theme folder is applied

replace_colors
    Whether custom colors is applied

` + utils.Bold("[Preprocesses]") + `
disable_sentry
    Prevents Sentry to send console log/error/warning to Spotify developers.
    Enable if you don't want to catch their attention when developing extension or app.

disable_ui_logging
    Various elements logs every user clicks, scrolls.
    Enable to stop logging and improve user experience.

remove_rtl_rule
    To support Arabic and other Right-To-Left language, Spotify added a lot of
    CSS rules that are obsoleted to Left-To-Right users.
    Enable to remove all of them and improve render speed.

expose_apis
    Leaks some Spotify's API, functions, objects to Spicetify global object that
    are useful for making extensions to extend Spotify functionality.

` + utils.Bold("[AdditionalOptions]") + `
experimental_features
    Allow access to Experimental Features of Spotify.
    Open it in profile menu (top right corner).

fastUser_switching
    Allow change account immediately. Open it in profile menu.

home
    Enable Home page. Access it in left sidebar.

lyric_always_show
    Force Lyrics button to show all the time in player bar.
    Useful for who want to watch visualization page.

lyric_force_no_sync
    Force displaying all of lyrics.

made_for_you_hub
    Enable Made For You page. Access it in left sidebar.

radio
    Enable Radio page. Access it in left sidebar.

song_page
    Clicks at song name in player bar will access that song page
    (instead of its album page) to discover playlists it appearing on.

visualization_high_framerate
    Force Visualization in Lyrics app to render in 60fps.`)
}
