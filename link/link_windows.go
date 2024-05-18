//go:build windows

/*
 * Copyright (C) 2024 OhItsTom
 * SPDX-License-Identifier: GPL-3.0-or-later
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
