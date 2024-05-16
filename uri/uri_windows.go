//go:build windows

/* Copyright © 2024
 *      Delusoire <deluso7re@outlook.com>
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

package uri

import (
	"bespoke/paths"
	"io"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

func RegisterURIScheme() error {
	access := uint32(registry.QUERY_VALUE | registry.SET_VALUE)
	key := registry.CURRENT_USER

	key, _, err := registry.CreateKey(key, `Software\Classes\bespoke`, access)
	if err != nil {
		return err
	}
	err = key.SetStringValue("", "URL:bespoke")
	if err != nil {
		return err
	}
	err = key.SetStringValue("URL Protocol", "")
	if err != nil {
		return err
	}

	key, _, err = registry.CreateKey(key, `shell\open\command`, access)
	if err != nil {
		return err
	}
	bin := filepath.Join(paths.ConfigPath, "bin", "bespoke.exe")

	if err := copyExeToBin(bin); err != nil {
		return err
	}

	cmd := `"` + bin + `" protocol "%1"`
	return key.SetStringValue("", cmd)
}

func copyExeToBin(bin string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	src, err := os.Open(exe)
	if err != nil {
		return err
	}
	defer src.Close()

	dest, err := os.Create(bin)
	if err != nil {
		return err
	}
	defer dest.Close()

	_, err = io.Copy(dest, src)
	return err
}
