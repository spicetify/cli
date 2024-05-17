/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"bespoke/archive"
	"bespoke/paths"
	"log"
	"net/http"
	"path/filepath"
	"regexp"

	"github.com/spf13/cobra"
)

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Update bespoke from GitHub",
	Run: func(cmd *cobra.Command, args []string) {
		if err := installHooks(); err != nil {
			log.Panicln(err.Error())
		}
	},
}

// TODO: let the user choose which release to install (& include version compatibility info)
func installHooks() error {
	res, err := http.Get("http://github.com/spicetify/hooks/releases/latest/download/hooks.tar.gz")
	if err != nil {
		return err
	}
	defer res.Body.Close()

	re := regexp.MustCompile(`^(.*)$`)

	return archive.UnTarGZ(res.Body, re, filepath.Join(paths.ConfigPath, "hooks"))
}

func init() {
	rootCmd.AddCommand(syncCmd)
}
