//go:build linux

/*
 * Copyright (C) 2024 ririxi, Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package paths

import (
	"os"
	"path/filepath"

	e "spicetify/errors"

	"github.com/adrg/xdg"
)

func isSpotifyInstallation(path string) bool {
	// ? Do we need both checks?
	_, err1 := os.Stat(filepath.Join(path, "Apps"))
	_, err2 := os.Stat(filepath.Join(path, "spotify"))
	return err1 == nil && err2 == nil
}

func GetPlatformSpotifyDataPath() (string, error) {
	paths := []string{
		"/opt/spotify/",
		"/opt/spotify/spotify-client/",
		"/usr/share/spotify/",
		"/usr/libexec/spotify/",
		"/var/lib/flatpak/app/com.spotify.Client/x86_64/stable/active/files/extra/share/spotify/",
	}

	homeRelativePaths := []string{
		".local/share/flatpak/app/com.spotify.Client/x86_64/stable/active/files/extra/share/spotify/",
		".local/share/spotify-launcher/install/usr/share/spotify/",
	}

	if home, err := os.UserHomeDir(); err != nil {
		for _, path := range homeRelativePaths {
			paths = append(paths, filepath.Join(home, path))
		}
	}

	for _, path := range paths {
		if isSpotifyInstallation(path) {
			return path, nil
		}
	}

	return "", e.ErrPathNotFound
}

func GetPlatformSpotifyExecPath(spotifyDataPath string) string {
	return filepath.Join(spotifyDataPath, "spotify")
}

func GetPlatformSpotifyConfigPath() (string, error) {
	pref := filepath.Join(xdg.ConfigHome, "spotify")
	if _, err := os.Stat(pref); err != nil {
		return "", err
	}
	return pref, nil
}
