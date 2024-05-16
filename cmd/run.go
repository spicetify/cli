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
	"os/exec"
	"path/filepath"

	"bespoke/paths"

	"github.com/adrg/xdg"
	"github.com/spf13/cobra"
)

var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Launch Spotify with your favorite addons",
	Run: func(cmd *cobra.Command, args []string) {
		execRun(args)
	},
}

func prepend[Type any](slice []Type, elems ...Type) []Type {
	return append(elems, slice...)
}

func execRun(args []string) {
	defaultArgs := []string{ /*"--disable-web-security",*/ }
	args = prepend(args, defaultArgs...)
	var execPath string
	if mirror {
		execPath = filepath.Join(xdg.ConfigHome, "Microsoft", "WindowsApps", "Spotify.exe")
		args = prepend(args, "--app-directory="+filepath.Join(paths.ConfigPath, "apps"))
	} else {
		execPath = paths.GetSpotifyExecPath(spotifyDataPath)
	}
	exec.Command(execPath, args...).Start()
}

func init() {
	rootCmd.AddCommand(runCmd)
}
