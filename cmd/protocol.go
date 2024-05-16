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
	"log"
	"os/exec"
	"regexp"
	"runtime"

	e "bespoke/errors"

	"github.com/spf13/cobra"
)

var protocolCmd = &cobra.Command{
	Use:   "protocol [uri]",
	Short: "Internal protocol handler",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := HandleProtocol(args[0])
		open(res)
		if err != nil {
			log.Panicln(err.Error())
		}
	},
}

func HandleProtocol(message string) (string, error) {
	re := regexp.MustCompile(`bespoke:(?<uuid>[^:]+):(?<action>[^:]+)(:(?<args>.*))?`)
	submatches := re.FindStringSubmatch(message)
	uuid := submatches[1]
	response := "spotify:app:rpc:bespoke:" + uuid
	action := submatches[2]
	arguments := submatches[4]
	err := hp(action, arguments)
	if err == nil {
		response += ":1"
	} else {
		response += ":0"
	}
	return response, err
}

func hp(action, arguments string) error {
	switch action {
	case "add":
		metadataURL := arguments
		return module.InstallModuleRemote(metadataURL)

	case "remove":
		identifier := module.NewStoreIdentifier(arguments)
		return module.DeleteModule(identifier)

	case "enable":
		identifier := module.NewStoreIdentifier(arguments)
		return module.ToggleModuleInVault(identifier)

	}
	return e.ErrUnsupportedOperation
}

func init() {
	rootCmd.AddCommand(protocolCmd)
}

func open(url string) error {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "cmd"
		args = []string{"/c", "start"}
	case "darwin":
		cmd = "open"
	default: // "linux", "freebsd", "openbsd", "netbsd"
		cmd = "xdg-open"
	}
	args = append(args, url)
	return exec.Command(cmd, args...).Start()
}
