//go:build windows

/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package uri

import (
	"io"
	"os"
	"path/filepath"
	"spicetify/paths"

	"golang.org/x/sys/windows/registry"
)

func RegisterURIScheme() error {
	access := uint32(registry.QUERY_VALUE | registry.SET_VALUE)
	key := registry.CURRENT_USER

	key, _, err := registry.CreateKey(key, `Software\Classes\spicetify`, access)
	if err != nil {
		return err
	}
	err = key.SetStringValue("", "URL:spicetify")
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
	bin := filepath.Join(paths.ConfigPath, "bin", "spicetify.exe")

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

	if err := os.MkdirAll(filepath.Dir(bin), 0770); err != nil {
		return err
	}
	dest, err := os.Create(bin)
	if err != nil {
		return err
	}
	defer dest.Close()

	_, err = io.Copy(dest, src)
	return err
}
