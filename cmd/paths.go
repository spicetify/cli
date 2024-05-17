/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"bespoke/paths"
	"fmt"

	"github.com/spf13/cobra"
)

var (
	showSpotiyData    bool
	showSpotifyConfig bool
	showConfig        bool
)

var pathsCmd = &cobra.Command{
	Use:   "paths",
	Short: "Print bespoke config",
	Run: func(cmd *cobra.Command, args []string) {
		if !showSpotiyData && !showSpotifyConfig && !showConfig {
			showSpotiyData = true
			showSpotifyConfig = true
			showConfig = true
		}
		fmt.Println("mirror:", mirror)
		if showSpotiyData {
			fmt.Println("Spotify data:", spotifyDataPath)
		}
		if showSpotifyConfig {
			fmt.Println("Spotify config:", spotifyConfigPath)
		}
		if showConfig {
			fmt.Println("config file:", paths.ConfigPath)
		}
	},
}

func init() {
	rootCmd.AddCommand(pathsCmd)

	pathsCmd.Flags().BoolVar(&showSpotiyData, "spotify-data", false, "Show Spotify data path")
	pathsCmd.Flags().BoolVar(&showSpotiyData, "spotify-config", false, "Show Spotify config path")
	pathsCmd.Flags().BoolVar(&showConfig, "config", false, "Show config path")
}
