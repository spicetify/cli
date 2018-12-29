package cmd

import (
	"os/exec"
	"path/filepath"
	"runtime"
)

// RestartSpotify .
func RestartSpotify() {
	switch runtime.GOOS {
	case "windows":
		exec.Command("taskkill", "/F", "/IM", "spotify.exe").Run()
		exec.Command(filepath.Join(spotifyPath, "spotify.exe")).Start()
	case "linux":
		exec.Command("pkill", "spotify").Run()
		exec.Command(filepath.Join(spotifyPath, "spotify")).Start()
	case "darwin":
		exec.Command("pkill", "Spotify").Run()
		exec.Command("open", "/Applications/Spotify.app").Start()
	}
}
