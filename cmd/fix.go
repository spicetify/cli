/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"spicetify/paths"
	"strings"

	"github.com/spf13/cobra"
)

var fixCmd = &cobra.Command{
	Use:   "fix",
	Short: "Fix your spotify installation",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Restoring Spotify to stock state")
		execFix()
	},
}

func execFix() {
	if mirror {
		os.RemoveAll(filepath.Join(paths.ConfigPath, "apps"))
	} else {
		spaBakGlob := filepath.Join(paths.GetSpotifyAppsPath(spotifyDataPath), "*.spa.bak")
		spaBaks, err := filepath.Glob(spaBakGlob)
		if err != nil {
			fmt.Println(err)
		}
		if len(spaBaks) == 0 {
			fmt.Println("Spotify is already in stock state!")
			return
		}

		for _, spaBak := range spaBaks {
			spa := strings.TrimSuffix(spaBak, ".bak")
			err = os.RemoveAll(strings.TrimSuffix(spa, ".spa"))
			if err != nil {
				fmt.Println(err)
			}
			err = os.Rename(spaBak, spa)
			if err != nil {
				fmt.Println(err)
			}
		}
	}
}

func init() {
	rootCmd.AddCommand(fixCmd)
}
