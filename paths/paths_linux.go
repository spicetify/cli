//go:build linux

/*
 * Copyright (C) 2024 ririxi, Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package paths

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/adrg/xdg"
)

func findSpotifyPath() string {
	userHome, err := os.UserHomeDir()
	if err != nil {
		return ""
	}

	potentialPaths := []string{
		"/opt/spotify/",
		"/opt/spotify/spotify-client/",
		"/usr/share/spotify/",
		"/usr/libexec/spotify/",
		"/var/lib/flatpak/app/com.spotify.Client/x86_64/stable/active/files/extra/share/spotify/",
		fmt.Sprintf("%s/.local/share/flatpak/app/com.spotify.Client/x86_64/stable/active/files/extra/share/spotify/", userHome),
	}

	for _, path := range potentialPaths {
		resolvedPath := path
		if isSpotifyInstalled(resolvedPath) {
			return resolvedPath
		}
	}

	return ""
}

func isSpotifyInstalled(path string) bool {
	_, err1 := os.Stat(filepath.Join(path, "Apps"))
	_, err2 := os.Stat(filepath.Join(path, "spotify"))
	return err1 == nil && err2 == nil
}

func GetPlatformDefaultSpotifyPath() string {
	return findSpotifyPath()
}

func GetSpotifyExecPath(spotifyPath string) string {
	return filepath.Join(spotifyPath, "spotify")
}

func GetSpotifyConfigPath() string {
	pref := filepath.Join(xdg.ConfigHome, "spotify")
	if _, err := os.Stat(pref); err == nil {
		return pref
	}

	return ""
}
