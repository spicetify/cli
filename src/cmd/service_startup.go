package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/spicetify/cli/src/utils"
)

func SetServiceAutoUpdate(enabled bool) {
	serviceSection := cfg.GetSection("Service")
	if enabled {
		serviceSection.Key("auto_update").SetValue("1")
	} else {
		serviceSection.Key("auto_update").SetValue("0")
	}

	if err := cfg.Write(); err != nil {
		utils.PrintWarning(fmt.Sprintf("Failed to save config: %s", err.Error()))
	}
}

func SyncServiceStartup(enabled bool) {
	exe, err := os.Executable()
	if err != nil {
		utils.PrintWarning(fmt.Sprintf("Failed to resolve executable path: %s", err.Error()))
		return
	}

	if err := setServiceStartup(enabled, exe); err != nil {
		utils.PrintWarning(err.Error())
	}
}

func setServiceStartup(enabled bool, exePath string) error {
	if runtime.GOOS == "windows" {
		startupDir := filepath.Join(os.Getenv("APPDATA"), "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
		startupFile := filepath.Join(startupDir, "Spicetify Service.cmd")

		if !enabled {
			if err := os.Remove(startupFile); err != nil && !os.IsNotExist(err) {
				return fmt.Errorf("failed to remove startup entry: %w", err)
			}
			return nil
		}

		if err := os.MkdirAll(startupDir, 0700); err != nil {
			return fmt.Errorf("failed to create startup folder: %w", err)
		}

		content := fmt.Sprintf(
			"@echo off\r\ncd /d \"%s\"\r\nstart \"\" /min \"%s\" service\r\n",
			filepath.Dir(exePath), exePath,
		)
		if err := os.WriteFile(startupFile, []byte(content), 0600); err != nil {
			return fmt.Errorf("failed to create startup entry: %w", err)
		}
		return nil
	}

	if runtime.GOOS == "linux" {
		configDir, err := os.UserConfigDir()
		if err != nil {
			return fmt.Errorf("failed to resolve config directory: %w", err)
		}

		autostartDir := filepath.Join(configDir, "autostart")
		startupFile := filepath.Join(autostartDir, "spicetify-service.desktop")

		if !enabled {
			if err := os.Remove(startupFile); err != nil && !os.IsNotExist(err) {
				return fmt.Errorf("failed to remove startup entry: %w", err)
			}
			return nil
		}

		if err := os.MkdirAll(autostartDir, 0700); err != nil {
			return fmt.Errorf("failed to create autostart folder: %w", err)
		}

		content := fmt.Sprintf(
			"[Desktop Entry]\nType=Application\nName=Spicetify Service\nExec=%s service\nX-GNOME-Autostart-enabled=true\nNoDisplay=true\n",
			strings.ReplaceAll(exePath, "\\", "\\\\"),
		)
		if err := os.WriteFile(startupFile, []byte(content), 0600); err != nil {
			return fmt.Errorf("failed to create startup entry: %w", err)
		}
		return nil
	}

	if runtime.GOOS == "darwin" {
		home, err := os.UserHomeDir()
		if err != nil {
			return fmt.Errorf("failed to resolve home directory: %w", err)
		}

		launchAgentsDir := filepath.Join(home, "Library", "LaunchAgents")
		startupFile := filepath.Join(launchAgentsDir, "com.spicetify.service.plist")

		if !enabled {
			if err := os.Remove(startupFile); err != nil && !os.IsNotExist(err) {
				return fmt.Errorf("failed to remove startup entry: %w", err)
			}
			return nil
		}

		if err := os.MkdirAll(launchAgentsDir, 0700); err != nil {
			return fmt.Errorf("failed to create launch agents folder: %w", err)
		}

		content := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.spicetify.service</string>
  <key>ProgramArguments</key>
  <array>
    <string>%s</string>
    <string>service</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
`, exePath)

		if err := os.WriteFile(startupFile, []byte(content), 0600); err != nil {
			return fmt.Errorf("failed to create startup entry: %w", err)
		}
		return nil
	}

	return nil
}
