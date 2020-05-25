package cmd

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// RestartSpotify .
func RestartSpotify(flags ...string) {
	switch runtime.GOOS {
	case "windows":
		exec.Command("taskkill", "/F", "/IM", "spotify.exe").Run()
		if isAppX {
			ps, _ := exec.LookPath("powershell.exe")
			exe := filepath.Join(os.Getenv("LOCALAPPDATA"), "Microsoft", "WindowsApps", "Spotify.exe")
			flags = append([]string{"-NoProfile", "-NonInteractive", `& "` + exe + `" --app-directory="` + appDestPath + `"`}, flags...)
			exec.Command(ps, flags...).Start()
		} else {
			exec.Command(filepath.Join(spotifyPath, "spotify.exe"), flags...).Start()
		}
	case "linux":
		exec.Command("pkill", "spotify").Run()
		exec.Command(filepath.Join(spotifyPath, "spotify"), flags...).Start()
	case "darwin":
		exec.Command("pkill", "Spotify").Run()
		flags = append([]string{"-a", "/Applications/Spotify.app"}, flags...)
		exec.Command("open", flags...).Start()
	}
}
