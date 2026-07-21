/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
export const fetchText = (path) => fetch(path).then((res) => res.text()).catch(() => null);
export const fetchJson = (path) => fetch(path).then((res) => res.json()).catch(() => null);
