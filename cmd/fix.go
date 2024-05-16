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
	"bespoke/paths"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

var fixCmd = &cobra.Command{
	Use:   "fix",
	Short: "Fix your spotify installation",
	Run: func(cmd *cobra.Command, args []string) {
		log.Println("Restoring Spotify to stock state")
		execFix()
	},
}

func execFix() {
	if mirror {
		os.RemoveAll(filepath.Join(paths.ConfigPath, "apps"))
	} else {
		spaBakGlob := filepath.Join(paths.GetSpotifyAppsPath(spotifyDataPath), "*.spa.bak")
		spaBaks, err := filepath.Glob(spaBakGlob)
		if err != nil {
			log.Fatalln(err.Error())
		}
		if len(spaBaks) == 0 {
			log.Println("Spotify is already in stock state!")
			return
		}

		for _, spaBak := range spaBaks {
			spa := strings.TrimSuffix(spaBak, ".bak")
			err = os.RemoveAll(strings.TrimSuffix(spa, ".spa"))
			if err != nil {
				log.Println(err.Error())
			}
			err = os.Rename(spaBak, spa)
			if err != nil {
				log.Println(err.Error())
			}
		}
	}
}

func init() {
	rootCmd.AddCommand(fixCmd)
}
