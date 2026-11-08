package cmd

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/spicetify/cli/src/utils"
)

func SpotifyKill() error {
	switch runtime.GOOS {
	case "windows":
		isRunning := exec.Command("tasklist", "/FI", "ImageName eq spotify.exe")
		result, _ := isRunning.Output()
		if !bytes.Contains(result, []byte("No tasks are running")) {
			exec.Command("taskkill", "/F", "/IM", "spotify.exe").Run()
		}
	case "linux":
		isRunning := exec.Command("pgrep", "-x", "spotify")
		_, err := isRunning.Output()
		if err == nil {
			exec.Command("pkill", "-x", "spotify").Run()
		}
	case "darwin":
		return killSpotifyDarwin(func(name string, args ...string) error {
			return exec.Command(name, args...).Run()
		})
	}
	return nil
}

func killSpotifyDarwin(run func(string, ...string) error) error {
	if err := run("pkill", "-x", "Spotify"); err != nil {
		var exitError *exec.ExitError
		if !errors.As(err, &exitError) || exitError.ExitCode() != 1 {
			return fmt.Errorf("could not stop Spotify: %w", err)
		}
	}

	deadline := time.Now().Add(5 * time.Second)
	for {
		err := run("pgrep", "-x", "Spotify")
		if err != nil {
			var exitError *exec.ExitError
			if errors.As(err, &exitError) && exitError.ExitCode() == 1 {
				return nil
			}
			return fmt.Errorf("could not check whether Spotify exited: %w", err)
		}
		if !time.Now().Before(deadline) {
			return fmt.Errorf("timed out waiting for Spotify to exit after 5 seconds")
		}
		time.Sleep(100 * time.Millisecond)
	}
}

func SpotifyStart(flags ...string) {
	enableDevtools := settingSection.Key("always_enable_devtools").MustBool(false)
	if enableDevtools {
		EnableDevTools()
	}

	launchFlag := settingSection.Key("spotify_launch_flags").Strings("|")
	if len(launchFlag) > 0 {
		flags = append(flags, launchFlag...)
	}

	switch runtime.GOOS {
	case "windows":
		if isAppX {
			ps, _ := exec.LookPath("powershell.exe")
			exe := filepath.Join(os.Getenv("LOCALAPPDATA"), "Microsoft", "WindowsApps", "Spotify.exe")
			cmd := `& "` + exe + `" --app-directory="` + appDestPath + `"`
			if len(flags) > 0 {
				cmd += " " + strings.Join(flags, " ")
			}
			exec.Command(ps, "-NoProfile", "-NonInteractive", "-Command", cmd).Start()
		} else {
			exec.Command(filepath.Join(spotifyPath, "spotify.exe"), flags...).Start()
		}
	case "linux":
		exec.Command(filepath.Join(spotifyPath, "spotify"), flags...).Start()
	case "darwin":
		flags = append([]string{"-a", "/Applications/Spotify.app", "--args"}, flags...)
		exec.Command("open", flags...).Start()
	}
}

func SpotifyRestart(flags ...string) {
	if err := SpotifyKill(); err != nil {
		utils.PrintError("Could not restart Spotify: " + err.Error())
		return
	}
	SpotifyStart(flags...)
}
