/*
 * Copyright (C) 2024 Delusoire
 *
 * This file is part of bespoke/cli.
 *
 * bespoke/cli is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * bespoke/cli is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with bespoke/cli. If not, see <https://www.gnu.org/licenses/>.
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
