/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"log"
	"spicetify/module"

	"github.com/spf13/cobra"
)

var useLocalPath bool

var pkgCmd = &cobra.Command{
	Use:   "pkg action",
	Short: "Manage modules",
	Run:   func(cmd *cobra.Command, args []string) {},
}

var pkgInstallCmd = &cobra.Command{
	Use:   "install murl",
	Short: "Install module",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		metadataURL := args[0]

		var err error
		if useLocalPath {
			err = module.InstallModuleLocal(metadataURL)
		} else {
			err = module.InstallModuleRemote(metadataURL)
		}

		if err != nil {
			log.Fatalln(err.Error())
		}
	},
}

var pkgDeleteCmd = &cobra.Command{
	Use:   "delete id",
	Short: "Uninstall module",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		identifier := module.NewStoreIdentifier(args[0])
		if err := module.DeleteModule(identifier); err != nil {
			log.Fatalln(err.Error())
		}
	},
}

var pkgEnableCmd = &cobra.Command{
	Use:   "enable id",
	Short: "Enable installed module",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		identifier := module.NewStoreIdentifier(args[0])
		if err := module.ToggleModuleInVault(identifier); err != nil {
			log.Fatalln(err.Error())
		}
	},
}

func init() {
	rootCmd.AddCommand(pkgCmd)

	pkgCmd.AddCommand(pkgInstallCmd, pkgDeleteCmd, pkgEnableCmd)

	pkgInstallCmd.Flags().BoolVar(&useLocalPath, "local", false, "Use local path")
}
