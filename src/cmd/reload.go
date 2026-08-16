package cmd

import (
	"os"
	"time"

	"github.com/spicetify/cli/src/utils"
)

// Reload updates the current theme's colors/CSS/JS/assets and pushes the
// change into an already-running Spotify client over the Chrome DevTools
// Protocol, without killing the Spotify process. This keeps the window open
// and playback running, unlike "apply" or "restart".
//
// The very first time it runs against a Spotify instance that wasn't
// started with remote debugging enabled, one restart is unavoidable to open
// that connection. Every following call reuses it and never restarts again,
// as long as Spotify keeps running (or is relaunched with the same flags,
// e.g. via "spotify_launch_flags" in the spicetify config).
func Reload() {
	if !isValidForWatching() {
		os.Exit(1)
	}

	CheckStates()
	InitSetting()

	refreshThemeCSS()
	if injectJS {
		refreshThemeJS()
	}
	if overwriteAssets {
		refreshThemeAssets()
	}

	debuggerURL := utils.GetDebuggerPath()
	if len(debuggerURL) == 0 {
		utils.PrintInfo("No live connection to Spotify found. Enabling DevTools and restarting once to set it up...")
		EnableDevTools()
		SpotifyRestart("--remote-debugging-port=9222", "--remote-allow-origins=*")

		for len(debuggerURL) == 0 {
			time.Sleep(100 * time.Millisecond)
			debuggerURL = utils.GetDebuggerPath()
		}

		utils.PrintSuccess("Applied theme. Spotify is now set up for live reload; run this command again next time to update colors without restarting.")
		return
	}

	if err := utils.SendCSSReload(&debuggerURL); err != nil {
		utils.PrintError("Could not live-reload Spotify: " + err.Error())
		utils.PrintInfo(`Run "spicetify restart" to apply changes manually`)
		os.Exit(1)
	}

	utils.PrintSuccess("Reloaded theme colors without restarting Spotify")
}
