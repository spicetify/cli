/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package module

import "path"

type Metadata struct {
	Name        string   `json:"name"`
	Version     string   `json:"version"`
	Authors     []string `json:"authors"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	Entries     struct {
		Js    string `json:"js"`
		Css   string `json:"css"`
		Mixin string `json:"mixin"`
	} `json:"entries"`
	Dependencies map[string]string `json:"dependencies"`
}

func (m *Metadata) getAuthor() string {
	return m.Authors[0]
}

func (m *Metadata) getModuleIdentifier() ModuleIdentifier {
	return ModuleIdentifier(path.Join(m.getAuthor(), m.Name))
}

func (m *Metadata) getStoreIdentifier() StoreIdentifier {
	return StoreIdentifier{
		ModuleIdentifier: m.getModuleIdentifier(),
		Version:          Version(m.Version),
	}
}
