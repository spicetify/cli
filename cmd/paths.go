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
