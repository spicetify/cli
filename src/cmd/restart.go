package cmd

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// EvalSpotifyRestart Restarts/starts spotify
func EvalSpotifyRestart(start bool, flags ...string) {
	launchFlag := settingSection.Key("spotify_launch_flags").Strings("|")
	if len(launchFlag) > 0 {
		flags = append(flags, launchFlag...)
	}

	enableDevtools := settingSection.Key("always_enable_devtools").MustBool(false)
	if enableDevtools {
		SetDevTools()
	}

	switch runtime.GOOS {
	case "windows":
		isRunning := exec.Command("tasklist", "/FI", "ImageName eq spotify.exe")
		result, _ := isRunning.Output()
		if !bytes.Contains(result, []byte("No tasks are running")) || start {
			exec.Command("taskkill", "/F", "/IM", "spotify.exe").Run()
			if isAppX {
				ps, _ := exec.LookPath("powershell.exe")
				exe := filepath.Join(os.Getenv("LOCALAPPDATA"), "Microsoft", "WindowsApps", "Spotify.exe")
				flags = append([]string{"-NoProfile", "-NonInteractive", `& "` + exe + `" --app-directory="` + appDestPath + `"`}, flags...)
				exec.Command(ps, flags...).Start()
			} else {
				exec.Command(filepath.Join(spotifyPath, "spotify.exe"), flags...).Start()
			}
		}
	case "linux":
		isRunning := exec.Command("pgrep", "spotify")
		_, err := isRunning.Output()
		if err == nil || start {
			exec.Command("pkill", "spotify").Run()
			exec.Command(filepath.Join(spotifyPath, "spotify"), flags...).Start()
		}
	case "darwin":
		isRunning := exec.Command("sh", "-c", "ps aux | grep 'Spotify' | grep -v grep")
		_, err := isRunning.CombinedOutput()
		if err == nil || start {
			exec.Command("pkill", "Spotify").Run()
			flags = append([]string{"-a", "/Applications/Spotify.app", "--args"}, flags...)
			exec.Command("open", flags...).Start()
		}
	}
}
