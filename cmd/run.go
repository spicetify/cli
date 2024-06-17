/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"os/exec"
	"path/filepath"

	"spicetify/paths"

	"github.com/spf13/cobra"
)

var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Launch Spotify with your favorite addons",
	Run: func(cmd *cobra.Command, args []string) {
		execRun(args)
	},
}

func prepend[Type any](slice []Type, elems ...Type) []Type {
	return append(elems, slice...)
}

func execRun(args []string) {
	defaultArgs := []string{ /*"--disable-web-security",*/ }
	args = prepend(args, defaultArgs...)
	if mirror {
		args = prepend(args, "--app-directory="+filepath.Join(paths.ConfigPath, "apps"))
	}
	exec.Command(spotifyExecPath, args...).Start()
}

func init() {
	rootCmd.AddCommand(runCmd)
}
