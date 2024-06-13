/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"fmt"
	"net/http"
	"path/filepath"
	"spicetify/archive"
	"spicetify/paths"

	"github.com/spf13/cobra"
)

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Update spicetify hooks from GitHub",
	Run: func(cmd *cobra.Command, args []string) {
		if err := installHooks(); err != nil {
			fmt.Println(err)
			return
		}
		fmt.Println("Hooks updated successfully")
	},
}

// TODO: let the user choose which release to install (& include version compatibility info)
func installHooks() error {
	res, err := http.Get("http://github.com/spicetify/hooks/releases/latest/download/hooks.tar.gz")
	if err != nil {
		return err
	}
	defer res.Body.Close()

	return archive.UnTarGZ(res.Body, filepath.Join(paths.ConfigPath, "hooks"))
}

func init() {
	rootCmd.AddCommand(syncCmd)
}
