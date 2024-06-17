/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package paths

import (
	"path/filepath"

	"github.com/adrg/xdg"
)

var (
	ConfigPath = filepath.Join(xdg.ConfigHome, "spicetify")
)

func GetDefaultSpotifyDataPath() string {
	path, _ := GetPlatformSpotifyDataPath()
	return path
}

func GetDefaultSpotifyExecPath(spotifyDataPath string) string {
	return GetPlatformSpotifyExecPath(spotifyDataPath)
}

func GetDefaultSpotifyConfigPath() string {
	path, _ := GetPlatformSpotifyConfigPath()
	return path
}

func GetSpotifyAppsPath(spotifyPath string) string {
	return filepath.Join(spotifyPath, "Apps")
}
