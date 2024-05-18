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

func GetDefaultSpotifyPath() string {
	path, _ := GetPlatformSpotifyPath()
	return path
}

func GetSpotifyAppsPath(spotifyPath string) string {
	return filepath.Join(spotifyPath, "Apps")
}

func GetDefaultSpotifyConfigPath() string {
	path, _ := GetPlatformSpotifyConfigPath()
	return path
}

func GetSpotifyExecPath(spotifyPath string) string {
	return GetPlatformSpotifyExecPath(spotifyPath)
}
