/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package cmd

import (
	"archive/zip"
	"fmt"
	"os"
	"path/filepath"
	"spicetify/archive"
	"spicetify/link"
	"spicetify/paths"
	"strings"

	"github.com/spf13/cobra"
)

var applyCmd = &cobra.Command{
	Use:   "apply",
	Short: "Apply spicetify patches on Spotify",
	Run: func(cmd *cobra.Command, args []string) {
		if err := execApply(); err != nil {
			fmt.Println(err)
		}
	},
}

func getApps() (src string, dest string) {
	src = paths.GetSpotifyAppsPath(spotifyDataPath)
	if mirror {
		dest = filepath.Join(paths.ConfigPath, "apps")
	} else {
		dest = src
	}
	return src, dest
}

func extractSpa(spa string, destFolder string) error {
	basename := filepath.Base(spa)
	extractDest := filepath.Join(destFolder, strings.TrimSuffix(basename, ".spa"))
	fmt.Println("Extracting", spa, "->", extractDest)
	r, err := zip.OpenReader(spa)
	if err != nil {
		return err
	}
	if err := archive.UnZip(&r.Reader, extractDest); err != nil {
		return err
	}
	if err := r.Close(); err != nil {
		panic(err)
	}
	if !mirror {
		spaBak := spa + ".bak"
		fmt.Println("Moving", spa, "->", spaBak)
		if err := os.Rename(spa, spaBak); err != nil {
			return err
		}
	}
	return nil
}

func patchFile(path string, patch func(string) string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	content := patch(string(raw))

	return os.WriteFile(path, []byte(content), 0700)
}

func patchIndexHtml(destXpuiPath string) error {
	fmt.Println("Patching xpui/index.html")
	return patchFile(filepath.Join(destXpuiPath, "index.html"), func(s string) string {
		return strings.Replace(s, `<script defer="defer" src="/vendor~xpui.js"></script><script defer="defer" src="/xpui.js"></script>`, `<script type="module" src="/hooks/index.js"></script>`, 1)
	})
}

func linkFiles(destXpuiPath string) error {
	folders := []string{"hooks", "modules", "store"}
	for _, folder := range folders {
		folderSrcPath := filepath.Join(paths.ConfigPath, folder)
		folderDestPath := filepath.Join(destXpuiPath, folder)
		fmt.Println("Linking", folderDestPath, "->", folderSrcPath)
		os.Remove(folderDestPath)
		if err := link.Create(folderSrcPath, folderDestPath); err != nil {
			return err
		}
	}
	return nil
}

func execApply() error {
	fmt.Println("Initializing spicetify")
	src, dest := getApps()

	spa := filepath.Join(src, "xpui.spa")
	if err := extractSpa(spa, dest); err != nil {
		return err
	}

	destXpuiPath := filepath.Join(dest, "xpui")
	if err := patchIndexHtml(destXpuiPath); err != nil {
		return err
	}
	return linkFiles(destXpuiPath)
}

func init() {
	rootCmd.AddCommand(applyCmd)
}
