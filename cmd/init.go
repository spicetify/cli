/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"fmt"
	"spicetify/module"

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
	return module.SetVault(&module.Vault{Modules: map[module.ModuleIdentifier]module.Module{}})
}
