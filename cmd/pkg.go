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

var pkgCmd = &cobra.Command{
	Use:   "pkg",
	Short: "Manage modules",
}

var pkgInstallCmd = &cobra.Command{
	Use:   "install url",
	Short: "Add and Install module",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		url := args[0]
		aurl := module.ArtifactURL(url)
		if err := addAndInstall(aurl); err != nil {
			fmt.Println(err)
		}
	},
}

func addAndInstall(aurl module.ArtifactURL) error {
	paurl := aurl.Parse()

	metadata, err := paurl.GetMetdata()
	if err != nil {
		return err
	}

	storeIdentifier := metadata.GetStoreIdentifier()

	if err := module.AddStoreInVault(storeIdentifier, &module.Store{
		Installed: false,
		Artifacts: []module.ArtifactURL{aurl},
		Providers: []module.ProviderURL{},
	}); err != nil {
		return err
	}

	return module.InstallModule(storeIdentifier)
}

var pkgDeleteCmd = &cobra.Command{
	Use:   "delete id",
	Short: "Delete and Remove module",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		identifier := module.NewStoreIdentifier(args[0])
		if err := deleteAndRemove(identifier); err != nil {
			fmt.Println(err)
		}
	},
}

func deleteAndRemove(identifier module.StoreIdentifier) error {
	if err := module.DeleteModule(identifier); err != nil {
		return err
	}

	return module.RemoveStoreInVault(identifier)
}

var pkgEnableCmd = &cobra.Command{
	Use:   "enable id",
	Short: "Enable or Disable module",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		identifier := module.NewStoreIdentifier(args[0])
		if err := module.EnableModuleInVault(identifier); err != nil {
			fmt.Println(err)
		}
	},
}

func init() {
	rootCmd.AddCommand(pkgCmd)

	pkgCmd.AddCommand(pkgInstallCmd, pkgDeleteCmd, pkgEnableCmd)
}
