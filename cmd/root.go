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

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	// autoUpdate bool

	mirror            bool
	spotifyDataPath   string
	spotifyExecPath   string
	spotifyConfigPath string
	cfgFile           string
)

var rootCmd = &cobra.Command{
	Use:   "spicetify",
	Short: "Make Spotify your own",
	Long:  `Bespoke is a CLI utility that empowers the desktop Spotify client with custom themes and extensions`,
	Run:   func(cmd *cobra.Command, args []string) {},
}

func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		panic(err)
	}
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().BoolVarP(&mirror, "mirror", "m", false, "Mirror Spotify files instead of patching them directly")
	rootCmd.PersistentFlags().StringVar(&spotifyDataPath, "spotify-data-path", paths.GetDefaultSpotifyDataPath(), "Override Spotify data folder")
	rootCmd.PersistentFlags().StringVar(&spotifyExecPath, "spotify-exec-path", paths.GetDefaultSpotifyExecPath(spotifyDataPath), "Override Spotify executable path")
	rootCmd.PersistentFlags().StringVar(&spotifyConfigPath, "spotify-config-path", paths.GetDefaultSpotifyConfigPath(), "Override Spotify config folder (containing prefs & offline.bnk)")

	viper.BindPFlag("mirror", rootCmd.PersistentFlags().Lookup("mirror"))
	viper.BindPFlag("spotify-data", rootCmd.PersistentFlags().Lookup("spotify-data"))
	viper.BindPFlag("spotify-config", rootCmd.PersistentFlags().Lookup("spotify-config"))

	defaultcfgFile := filepath.Join(paths.ConfigPath, "config.yaml")

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", defaultcfgFile, "config file")
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
