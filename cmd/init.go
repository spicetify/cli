/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"log"
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
			log.Println("Error occurred! error:")
			log.Panicln(err.Error())
		}
	},
}

func init() {
	rootCmd.AddCommand(initCmd)
}

func execInit() error {
	if err := uri.RegisterURIScheme(); err != nil {
		log.Println(err.Error())
	}

	return module.SetVault(&module.Vault{Modules: map[module.ModuleIdentifier]module.Module{
		"official/stdlib": {
			Enabled: "",
			Remotes: []string{"https://github.com/spicetify/stdlib/repo.json"},
			V:       map[module.Version]module.Store{},
		},
	}})
}
