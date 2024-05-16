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
	"fmt"
	"os"
	"path/filepath"

	"bespoke/paths"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	autoUpdate bool

	mirror            bool
	spotifyDataPath   string
	spotifyConfigPath string
	cfgFile           string
)

var rootCmd = &cobra.Command{
	Use:   "bespoke",
	Short: "Make Spotify your own",
	Long:  `Bespoke is a CLI utility that empowers the desktop Spotify client with custom themes and extensions`,
	Run:   func(cmd *cobra.Command, args []string) {},
}

func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.Flags().BoolVar(&autoUpdate, "auto-update", false, "Toggle auto updates for bespoke")

	rootCmd.PersistentFlags().BoolVarP(&mirror, "mirror", "m", false, "Mirror Spotify files instead of patching them directly")
	rootCmd.PersistentFlags().StringVar(&spotifyDataPath, "spotify-data", paths.GetSpotifyPath(), "Override Spotify data folder (containing the spotify executable)")
	rootCmd.PersistentFlags().StringVar(&spotifyConfigPath, "spotify-config", paths.GetSpotifyConfigPath(), "Override Spotify config folder (containing prefs & offline.bnk)")
	viper.BindPFlag("mirror", rootCmd.PersistentFlags().Lookup("mirror"))
	viper.BindPFlag("spotify-data", rootCmd.PersistentFlags().Lookup("spotify-data"))
	viper.BindPFlag("spotify-config", rootCmd.PersistentFlags().Lookup("spotify-config"))

	defaultcfgFile := filepath.Join(paths.ConfigPath, "config.yaml")

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", defaultcfgFile, "config file (default is "+defaultcfgFile+")")
}

func initConfig() {
	viper.SetConfigFile(cfgFile)
	viper.AutomaticEnv()

	viper.SetDefault("mirror", mirror)
	viper.SetDefault("spotify-data", spotifyDataPath)
	viper.SetDefault("spotify-config", spotifyConfigPath)

	if err := viper.ReadInConfig(); err == nil {
		fmt.Fprintln(os.Stderr, "Using config file:", viper.ConfigFileUsed())

		mirror = viper.GetBool("mirror")
		spotifyDataPath = viper.GetString("spotify-data")
		spotifyConfigPath = viper.GetString("spotify-config")
	}
}
