//go:build darwin

/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package uri

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Foundation
#include "build/darwin/handler.h"
*/

import "C"

func RegisterURIScheme() error {
	return nil
}
