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
	"bytes"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

var devCmd = &cobra.Command{
	Use:   "dev",
	Short: "Patch Spotify to open in app-developer mode next time it launches",
	Run: func(cmd *cobra.Command, args []string) {
		if err := execDev(); err == nil {
			log.Println("Mode app-developer enabled for next launch")
		} else {
			log.Fatalln(err.Error())
		}
	},
}

func execDev() error {
	offlineBnkPath := filepath.Join(spotifyConfigPath, "offline.bnk")

	file, err := os.OpenFile(offlineBnkPath, os.O_RDWR, 0644)
	if err != nil {
		return err
	}
	defer file.Close()

	buf := new(bytes.Buffer)
	buf.ReadFrom(file)
	content := buf.String()
	firstLocation := strings.Index(content, "app-developer")
	firstPatchLocation := int64(firstLocation + 14)

	secondLocation := strings.LastIndex(content, "app-developer")
	secondPatchLocation := int64(secondLocation + 15)

	file.WriteAt([]byte{50}, firstPatchLocation)
	file.WriteAt([]byte{50}, secondPatchLocation)
	return nil
}

func init() {
	rootCmd.AddCommand(devCmd)
}
