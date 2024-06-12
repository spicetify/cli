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

// TODO: avoid usage
func (m *Metadata) GetModuleIdentifier() ModuleIdentifier {
	return ModuleIdentifier(path.Join(m.getAuthor(), m.Name))
}

// TODO: avoid usage
func (m *Metadata) GetStoreIdentifier() StoreIdentifier {
	return StoreIdentifier{
		ModuleIdentifier: m.GetModuleIdentifier(),
		Version:          Version(m.Version),
	}
}
