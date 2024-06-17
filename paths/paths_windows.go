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

func GetPlatformSpotifyDataPath() (string, error) {
	return filepath.Join(xdg.DataDirs[0], "Spotify"), nil
}

func GetPlatformSpotifyExecPath(spotifyDataPath string) string {
	return filepath.Join(spotifyDataPath, "spotify.exe")
}

func GetPlatformSpotifyConfigPath() (string, error) {
	return filepath.Join(xdg.ConfigHome, "Spotify"), nil
}
