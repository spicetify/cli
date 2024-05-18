/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package errors

import "errors"

var ErrUnsupportedOperation = errors.New("this opperation is not supported")
var ErrPathNotFound = errors.New("couldn't find path")
