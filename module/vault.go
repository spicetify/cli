/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package module

import (
	"encoding/json"
	"errors"
	"os"
	"path"
	"path/filepath"
	"regexp"
)

type Store struct {
	Installed bool          `json:"installed"`
	Artifacts []ArtifactURL `json:"artifacts"`
}

type Author string
type Name string
type Version string
type ModuleIdentifierStr string

type Module struct {
	Enabled Version           `json:"enabled"`
	Remotes []string          `json:"remotes"`
	V       map[Version]Store `json:"v"`
}
type Vault struct {
	Modules map[ModuleIdentifierStr]Module `json:"modules"`
}

func (v *Vault) getModule(identifier ModuleIdentifierStr) *Module {
	module, ok := v.Modules[identifier]
	if !ok {
		module = Module{
			Enabled: "",
			V:       map[Version]Store{},
		}
		v.Modules[identifier] = module
	}
	return &module
}

func (v *Vault) setModule(identifier ModuleIdentifierStr, module *Module) {
	v.Modules[identifier] = *module
}

func (v *Vault) getEnabledStore(identifier ModuleIdentifierStr) (*Store, bool) {
	module := Store{}
	versions := v.getModule(identifier)
	module, ok := versions.V[versions.Enabled]
	return &module, ok
}

func (v *Vault) getStore(m *Metadata) (*Store, bool) {
	moduleIdentifier := m.getModuleIdentifier()
	versions := v.getModule(moduleIdentifier.toPath())
	store, ok := versions.V[Version(m.Version)]
	return &store, ok
}

func (v *Vault) setStore(identifier StoreIdentifier, module *Store) bool {
	if len(string(identifier.Version)) == 0 {
		return false
	}
	versions := v.getModule(identifier.ModuleIdentifier.toPath())
	versions.V[identifier.Version] = *module
	return true
}

func GetVault() (*Vault, error) {
	file, err := os.Open(vaultPath)
	if err != nil {
		return &Vault{}, err
	}
	defer file.Close()

	var vault Vault
	err = json.NewDecoder(file).Decode(&vault)
	return &vault, err
}

func SetVault(vault *Vault) error {
	vaultJson, err := json.Marshal(vault)
	if err != nil {
		return err
	}

	os.MkdirAll(modulesFolder, os.ModePerm)
	return os.WriteFile(vaultPath, vaultJson, 0700)
}

func MutateVault(mutate func(*Vault) bool) error {
	vault, err := GetVault()
	if err != nil {
		return err
	}

	if ok := mutate(vault); !ok {
		return errors.New("failed to mutate vault")
	}

	return SetVault(vault)
}

type ModuleIdentifier struct {
	Author
	Name
}

// <owner>/<module>
var moduleIdentifierRe = regexp.MustCompile(`^(?<author>[^/]+)/(?<name>[^/]+)$`)

func NewModuleIdentifier(identifier string) ModuleIdentifier {
	parts := moduleIdentifierRe.FindStringSubmatch(identifier)
	return ModuleIdentifier{
		Author: Author(parts[1]),
		Name:   Name(parts[2]),
	}
}

func (mi *ModuleIdentifier) toPath() ModuleIdentifierStr {
	return ModuleIdentifierStr(path.Join(string(mi.Author), string(mi.Name)))
}

func (mi *ModuleIdentifier) toFilePath() string {
	return filepath.Join(modulesFolder, string(mi.Author), string(mi.Name))
}

type StoreIdentifier struct {
	ModuleIdentifier
	Version
}

// <owner>/<module>/<version>
var storeIdentifierRe = regexp.MustCompile(`^(?<identifier>[^/]+/[^/]+)/(?<version>[^/]*)$`)

func NewStoreIdentifier(identifier string) StoreIdentifier {
	parts := storeIdentifierRe.FindStringSubmatch(identifier)
	return StoreIdentifier{
		ModuleIdentifier: NewModuleIdentifier(parts[1]),
		Version:          Version(parts[2]),
	}
}

func (si *StoreIdentifier) toPath() string {
	return filepath.Join(string(si.Author), string(si.Name), string(si.Version))
}

func (si *StoreIdentifier) toFilePath() string {
	return filepath.Join(storeFolder, string(si.Author), string(si.Name), string(si.Version))
}
