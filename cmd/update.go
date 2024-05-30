/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"bytes"
	"errors"
	"log"
	"os"
	"spicetify/paths"
	"strings"

	"github.com/spf13/cobra"
)

var updateCmd = &cobra.Command{
	Use:       "update on|off",
	Short:     "Patch Spotify to block/unblock updates",
	Args:      cobra.ExactArgs(1),
	ValidArgs: []string{"on", "off"},
	Run: func(cmd *cobra.Command, args []string) {
		b := args[0] == "on"
		if err := toggleUpdates(b); err == nil {
			log.Println("Patched the executable successfully")
		} else {
			log.Fatalln(err.Error())
		}
	},
}

func toggleUpdates(b bool) error {
	exe := paths.GetSpotifyExecPath(spotifyDataPath)

	file, err := os.OpenFile(exe, os.O_RDWR, 0644)
	if err != nil {
		return err
	}
	defer file.Close()

	buf := new(bytes.Buffer)
	buf.ReadFrom(file)
	content := buf.String()

	i := strings.Index(content, "desktop-update/")
	if i == -1 {
		return errors.New("can't find update endpoint in executable")
	}
	var s string
	if b {
		s = "v2/update"
	} else {
		s = "no/thanks"
	}
	file.WriteAt([]byte(s), int64(i+15))
	return nil
}

func init() {
	rootCmd.AddCommand(updateCmd)
}
