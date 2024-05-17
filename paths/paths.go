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
	ConfigPath = filepath.Join(xdg.ConfigHome, "bespoke")
)

func GetSpotifyPath() string {
	return GetPlatformDefaultSpotifyPath()
}

func GetSpotifyAppsPath(spotifyPath string) string {
	return filepath.Join(spotifyPath, "Apps")
}
