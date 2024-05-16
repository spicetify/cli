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
	"bespoke/archive"
	"bespoke/paths"
	"log"
	"net/http"
	"path/filepath"
	"regexp"

	"github.com/spf13/cobra"
)

var syncCmd = &cobra.Command{
	Use:   "sync",
	Short: "Update bespoke from GitHub",
	Run: func(cmd *cobra.Command, args []string) {
		if err := installHooks(); err != nil {
			log.Panicln(err.Error())
		}
	},
}

// TODO: let the user choose which release to install (& include version compatibility info)
func installHooks() error {
	res, err := http.Get("http://github.com/spicetify/hooks/releases/latest/download/hooks.tar.gz")
	if err != nil {
		return err
	}
	defer res.Body.Close()

	re := regexp.MustCompile(`^(.*)$`)

	return archive.UnTarGZ(res.Body, re, filepath.Join(paths.ConfigPath, "hooks"))
}

func init() {
	rootCmd.AddCommand(syncCmd)
}
