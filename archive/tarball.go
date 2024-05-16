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
