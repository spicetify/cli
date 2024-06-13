/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

var devCmd = &cobra.Command{
	Use:   "dev",
	Short: "Patch Spotify to open in app-developer mode next time it launches",
	Run: func(cmd *cobra.Command, args []string) {
		if err := execDev(); err != nil {
			fmt.Println(err)
			return
		}
		fmt.Println("Mode app-developer enabled for next launch")

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

	if i := strings.Index(content, "app-developer"); i != -1 {
		file.WriteAt([]byte("2"), int64(i+14))
	}
	if i := strings.LastIndex(content, "app-developer"); i != -1 {
		file.WriteAt([]byte("2"), int64(i+15))
	}

	return nil
}

func init() {
	rootCmd.AddCommand(devCmd)
}
