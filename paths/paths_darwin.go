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

func GetPlatformDefaultSpotifyPath() string {
	return "/Applications/Spotify.app/Contents/Resources"
}

func GetSpotifyExecPath(spotifyPath string) string {
	return filepath.Join(spotifyPath, "Spotify")
}

func GetSpotifyConfigPath() string {
	return os.Getenv("HOME") + "/Library/Application Support/Spotify"
}
