//go:build unix

/*
 * Copyright (C) 2024 OhItsTom
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package link

import "os"

func Create(oldname string, newname string) error {
	return os.Symlink(oldname, newname)
}
