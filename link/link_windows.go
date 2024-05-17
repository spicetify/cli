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

package link

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/Microsoft/go-winio"
	"golang.org/x/sys/windows"
)

func Create(target, mountPt string) error {
	_target, err := filepath.Abs(target)
	if err != nil {
		return fmt.Errorf("failed to get absolute path of target %s: %v", target, err)
	}
	_mountPt, err := windows.UTF16PtrFromString(mountPt)
	if err != nil {
		return fmt.Errorf("failed to get UTF16 pointer of mount point %s: %v", mountPt, err)
	}

	err = os.Mkdir(mountPt, 0777)
	if err != nil {
		return fmt.Errorf("failed to create directory %s: %v", mountPt, err)
	}
	defer func() {
		if err != nil {
			os.Remove(mountPt)
		}
	}()

	handle, err := windows.CreateFile(_mountPt,
		windows.GENERIC_WRITE,
		0,
		nil,
		windows.OPEN_EXISTING,
		windows.FILE_FLAG_BACKUP_SEMANTICS,
		0)
	if err != nil {
		return fmt.Errorf("failed to create file handle for %s: %v", mountPt, err)
	}
	defer windows.CloseHandle(handle)

	rp := winio.ReparsePoint{
		Target:       _target,
		IsMountPoint: true,
	}
	data := winio.EncodeReparsePoint(&rp)

	var size uint32
	err = windows.DeviceIoControl(
		handle,
		windows.FSCTL_SET_REPARSE_POINT,
		&data[0],
		uint32(len(data)),
		nil,
		0,
		&size,
		nil)
	if err != nil {
		return fmt.Errorf("failed to set reparse point: %v", err)
	}
	return nil
}
