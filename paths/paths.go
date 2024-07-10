/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package paths

import (
	"os"
	"path/filepath"
)

var (
	ConfigPath string
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

func init() {
	exe, err := os.Executable()
	if err != nil {
		panic(err)
	}
	realExe, err := filepath.EvalSymlinks(exe)
	if err != nil {
		panic(err)
	}
	ConfigPath = filepath.Dir(filepath.Dir(realExe))
}
