//go:build darwin

/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package paths

import (
	"os"
	"path/filepath"
)

func GetPlatformSpotifyPath() (string, error) {
	return "/Applications/Spotify.app/Contents/Resources", nil
}

func GetPlatformSpotifyExecPath(spotifyPath string) string {
	return filepath.Join(spotifyPath, "Spotify")
}

func GetPlatformSpotifyConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "Library/Application Support/Spotify"), nil
}
