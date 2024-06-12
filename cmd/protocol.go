/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"log"
	"net/url"
	"os/exec"
	"runtime"
	"spicetify/module"
	"strings"

	e "spicetify/errors"

	"github.com/spf13/cobra"
)

var protocolCmd = &cobra.Command{
	Use:   "protocol [uri]",
	Short: "Internal protocol handler",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		res, err := HandleProtocol(args[0])
		if len(res) > 0 {
			open("spotify:app:spicetify:" + res)
		}
		if err != nil {
			log.Panicln(err.Error())
		}
	},
}

func HandleProtocol(uri string) (string, error) {
	u, err := url.Parse(uri)
	if err != nil || u.Scheme != "spicetify" {
		return "", err
	}
	uuid, action, _ := strings.Cut(u.Opaque, ":")
	response := u.Scheme + ":" + uuid + ":"
	arguments := u.Query()
	err = hp(action, arguments)
	if err == nil {
		response += "1"
	} else {
		response += "0"
	}
	return response, err
}

func hp(action string, arguments url.Values) error {
	switch action {
	case "add":
		_artifacts := arguments["artifacts"]
		_providers := arguments["providers"]

		identifier := module.NewStoreIdentifier(arguments.Get("id"))
		artifacts := make([]module.ArtifactURL, len(_artifacts))
		for i, a := range _artifacts {
			artifacts[i] = module.ArtifactURL(a)
		}
		providers := make([]module.ProviderURL, len(_providers))
		for i, p := range _providers {
			providers[i] = module.ProviderURL(p)
		}

		return module.AddStoreInVault(identifier, &module.Store{
			Installed: false,
			Artifacts: artifacts,
			Providers: providers,
		})

	case "install":
		identifier := module.NewStoreIdentifier(arguments.Get("id"))
		return module.InstallModule(identifier)

	case "enable":
		identifier := module.NewStoreIdentifier(arguments.Get("id"))
		return module.EnableModuleInVault(identifier)

	case "delete":
		identifier := module.NewStoreIdentifier(arguments.Get("id"))
		return module.DeleteModule(identifier)

	case "remove":
		identifier := module.NewStoreIdentifier(arguments.Get("id"))
		return module.RemoveStoreInVault(identifier)

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
