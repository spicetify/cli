/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package archive

import (
	"archive/tar"
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
	"regexp"
)

func UnTarGZ(r io.Reader, src *regexp.Regexp, dest string) error {
	gzipReader, err := gzip.NewReader(r)
	if err != nil {
		return err
	}
	defer gzipReader.Close()

	tarReader := tar.NewReader(gzipReader)

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		nameRelToSrc := src.FindStringSubmatch(header.Name)

		if nameRelToSrc == nil {
			continue
		}

		tarEntryDest := filepath.Join(dest, nameRelToSrc[1])

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.Mkdir(tarEntryDest, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			tarEntryFile, err := os.Create(tarEntryDest)
			if err != nil {
				return err
			}
			if _, err := io.Copy(tarEntryFile, tarReader); err != nil {
				return err
			}
			tarEntryFile.Close()
		}
	}

	return nil
}
