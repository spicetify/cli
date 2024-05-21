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
)

func UnTarGZ(r io.Reader, dest string) error {
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

		tarEntryDest := filepath.Join(dest, header.Name)

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
