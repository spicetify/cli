/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package errors

import "errors"

var ErrUnsupportedOperation = errors.New("this opperation is not supported")
var ErrURIUnsupportedOpeartion = errors.New("this operation is not supported on this platform. URI Handler is assigned after launching the app")
