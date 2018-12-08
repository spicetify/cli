package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"runtime"

	"./cmd"
	"./utils"
	"gopkg.in/mattn/go-colorable.v0"
)

const (
	version = "0.2.0"
)

func init() {
	if runtime.GOOS != "windows" && runtime.GOOS != "darwin" && runtime.GOOS != "linux" {
		utils.PrintError("Unsupported OS.")
		os.Exit(1)
	}

	log.SetFlags(0)

	if len(os.Args) < 2 {
		help()
		os.Exit(0)
	}

	quiet := false
	for _, v := range os.Args {
		if v == "-q" || v == "--quiet" {
			quiet = true
			break
		}
	}

	cmd.Init(quiet)

	for k, v := range os.Args {
		switch v {
		case "-c", "--config":
			log.Print(cmd.GetConfigPath())
			os.Exit(0)
		case "-h", "--help":
			if len(os.Args) > k+1 && os.Args[k+1] == "config" {
				helpConfig()
			} else {
				help()
			}

			os.Exit(0)
		case "-v", "--version":
			log.Print(version)
			os.Exit(0)
		}
	}

	if quiet {
		log.SetOutput(ioutil.Discard)
	} else {
		// Supports print color output for Windows
		log.SetOutput(colorable.NewColorableStdout())
	}
}

func main() {
	utils.PrintBold("spicetify v" + version)
	args := os.Args[1:]

	for _, argv := range args {
		switch argv {
		case "backup":
			cmd.Backup()

		case "clear":
			cmd.ClearBackup()

		case "apply":
			cmd.Apply()

		case "update":
			cmd.UpdateCSS()

		case "restore":
			cmd.Restore()

		case "enable-devtool":
			cmd.SetDevTool(true)

		case "disable-devtool":
			cmd.SetDevTool(false)

		default:
			if argv[0] != '-' {
				utils.PrintError(`Command "` + argv + `" not found.`)
				utils.PrintInfo(`Run "spicetify -h" for list of valid commands.`)
				os.Exit(1)
			}
		}
	}
}

func help() {
	fmt.Println("spicetify v" + version)
	fmt.Print(`USAGE
spicetify <command>

DESCRIPTION
Customize Spotify client UI and functionality

COMMANDS
backup              Start backup and preprocessing app files.
apply               Apply customization.
restore             Restore Spotify to original state.
clear               Clear current backup files.
enable-devtool      Enable Spotify's developer tools (Console, Inspect Elements,...),
                    Hit Ctrl + Shift + I in the client to start using.
disable-devtool     Disable Spotify's developer tools.

FLAGS
-q, --quiet         Quiet mode (no output). Be careful, dangerous operations like
                    clear backup, restore will proceed without prompting permission.
-c, --config        Print config file path and quit
-h, --help          Print this help text and quit
-v, --version       Print version number and quit
`)
}

func helpConfig() {
	fmt.Print(`CONFIG MEANING
[Setting]
spotify_path
    Path to Spotify directory

current_theme
    Name of folder of your theme

inject_css
    Whether custom css from user.css in theme folder is applied

replace_colors
    Whether custom colors is applied

[Preprocesses]
disable_sentry
    Prevents Sentry to send console log/error/warning to Spotify developers.
    Enable if you don't want to catch their attention when developing extension or app.

disable_ui_logging
    Various elements logs every user click, scroll.
    Enable to stop logging and improve user experience.

remove_rtl_rule
    To support Arabic and other Right-To-Left language, Spotify added a lot of CSS rules
    that are obsoleted to Left-To-Right users.
    Enable to remove all of them and improve render speed.

expose_apis
    Leaks some Spotify's API, functions, objects to Spicetify global object that are
    useful for making extensions to extend Spotify functionality.

[AdditionalOptions]
experimental_features
    Allow access to Experimental Features of Spotify. Open it in profile menu (top right corner).

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
    Force Visualization in Lyrics app to render in 60fps.
`)
}
