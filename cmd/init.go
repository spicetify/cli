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
	"bespoke/module"
	"bespoke/uri"
	"log"
	"runtime"

	"github.com/spf13/cobra"
	"golang.org/x/sys/windows/registry"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Perform one-time bespoke initization",
	Long:  "required to be ran at least once per installation",
	Run: func(cmd *cobra.Command, args []string) {
		if err := execInit(); err != nil {
			log.Println("Error occurred! Try running this command (and only this command) in an elevated shell; error:")
			log.Panicln(err.Error())
		}
	},
}

func init() {
	rootCmd.AddCommand(initCmd)
}

func enableDeveloperModeOnWindows() error {
	if runtime.GOOS != "windows" {
		return nil
	}

	access := uint32(registry.QUERY_VALUE | registry.SET_VALUE)
	key := registry.LOCAL_MACHINE

	key, err := registry.OpenKey(key, `Software\Microsoft\Windows\CurrentVersion\AppModelUnlock`, access)
	if err != nil {
		return err
	}

	return key.SetDWordValue("AllowDevelopmentWithoutDevLicense", 1)
}

func execInit() error {
	if err := enableDeveloperModeOnWindows(); err != nil {
		return err
	}

	if err := uri.RegisterURIScheme(); err != nil {
		log.Println(err.Error())
	}

	return module.SetVault(&module.Vault{Modules: map[module.ModuleIdentifierStr]module.Module{
		"official/stdlib": module.Module{
			Remotes: []string{"https://github.com/spicetify/stdlib/repo.json"},
		},
	}})
}
