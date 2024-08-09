/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"spicetify/module"
	"spicetify/paths"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
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
	configFile := viper.GetViper().ConfigFileUsed()
	if err := viper.SafeWriteConfigAs(configFile); err != nil {
		if _, ok := err.(viper.ConfigFileAlreadyExistsError); !ok {
			return err
		}
	}

	folders := []string{"hooks", "modules", "store"}
	for _, folder := range folders {
		folderPath := filepath.Join(paths.ConfigPath, folder)
		os.Remove(folderPath)
	}

	return module.SetVault(&module.Vault{Modules: map[module.ModuleIdentifier]module.Module{}})
}
