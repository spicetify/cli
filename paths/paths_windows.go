//go:build windows

/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package paths

import (
	"path/filepath"

	"github.com/adrg/xdg"
)

func GetPlatformSpotifyPath() (string, error) {
	return filepath.Join(xdg.DataDirs[0], "Spotify"), nil
}

func GetPlatformSpotifyExecPath(spotifyPath string) string {
	return filepath.Join(spotifyPath, "spotify.exe")
}

func GetPlatformSpotifyConfigPath() (string, error) {
	return filepath.Join(xdg.ConfigHome, "Spotify"), nil
}
