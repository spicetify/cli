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

var pkgCmd = &cobra.Command{
	Use:   "pkg",
	Short: "Manage modules",
}

var pkgInstallCmd = &cobra.Command{
	Use:   "install murl",
	Short: "Install module",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		url := args[0]
		aurl := module.ArtifactURL(url)
		paurl := aurl.Parse()

		metadata, err := paurl.GetMetdata()
		if err != nil {
			log.Fatalln(err.Error())
			return
		}

		storeIdentifier := metadata.GetStoreIdentifier()

		if err := module.AddStoreInVault(storeIdentifier, &module.Store{
			Installed: false,
			Artifacts: []module.ArtifactURL{aurl},
			Providers: []module.ProviderURL{},
		}); err != nil {
			log.Fatalln(err.Error())
			return
		}

		if err := module.InstallModule(storeIdentifier); err != nil {
			log.Fatalln(err.Error())
			return
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
			return
		}

		if err := module.RemoveStoreInVault(identifier); err != nil {
			log.Fatalln(err.Error())
			return
		}
	},
}

var pkgEnableCmd = &cobra.Command{
	Use:   "enable id",
	Short: "Enable installed module",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		identifier := module.NewStoreIdentifier(args[0])
		if err := module.EnableModuleInVault(identifier); err != nil {
			log.Fatalln(err.Error())
		}
	},
}

func init() {
	rootCmd.AddCommand(pkgCmd)

	pkgCmd.AddCommand(pkgInstallCmd, pkgDeleteCmd, pkgEnableCmd)
}
