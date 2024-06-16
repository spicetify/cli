/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"fmt"
	"spicetify/module"
	"spicetify/uri"

	"github.com/spf13/cobra"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Perform one-time spicetify initization",
	Long:  "required to be ran at least once per installation",
	Run: func(cmd *cobra.Command, args []string) {
		if err := execInit(); err != nil {
			fmt.Println(err)
			return
		}
		fmt.Println("Initialized spicetify")
	},
}

func init() {
	rootCmd.AddCommand(initCmd)
}

func execInit() error {
	if err := uri.RegisterURIScheme(); err != nil {
		fmt.Println(err)
	}

	return module.SetVault(&module.Vault{Modules: map[module.ModuleIdentifier]module.Module{
		"": {
			Enabled: "0.0.0",
			V: map[module.Version]module.Store{
				"0.0.0": {
					Installed: false,
					Artifacts: []module.ArtifactURL{},
					Providers: []module.ProviderURL{"https://raw.githubusercontent.com/spicetify/pkgs/main/vault.json"},
				},
			},
		}}})
}
