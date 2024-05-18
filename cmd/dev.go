/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
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
