/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package module

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
)

type Store struct {
	Installed bool          `json:"installed"`
	Artifacts []ArtifactURL `json:"artifacts"`
	Providers []ProviderURL `json:"providers"`
}

type Author string
type Name string
type Version string
type ModuleIdentifier string

func (mi ModuleIdentifier) toFilePath() string {
	return filepath.Join(modulesFolder, string(mi))
}

type Module struct {
	Enabled Version           `json:"enabled"`
	V       map[Version]Store `json:"v"`
}
type Vault struct {
	Modules map[ModuleIdentifier]Module `json:"modules"`
}

func (v *Vault) getModule(identifier ModuleIdentifier) *Module {
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

func (v *Vault) setModule(identifier ModuleIdentifier, module *Module) {
	v.Modules[identifier] = *module
}

func (v *Vault) getEnabledStore(identifier ModuleIdentifier) (*Store, bool) {
	module := Store{}
	versions := v.getModule(identifier)
	module, ok := versions.V[versions.Enabled]
	return &module, ok
}

func (v *Vault) getStore(identifier StoreIdentifier) (*Store, bool) {
	versions := v.getModule(identifier.ModuleIdentifier)
	store, ok := versions.V[identifier.Version]
	return &store, ok
}

func (v *Vault) setStore(identifier StoreIdentifier, module *Store) bool {
	if len(string(identifier.Version)) == 0 {
		return false
	}
	versions := v.getModule(identifier.ModuleIdentifier)
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

type StoreIdentifier struct {
	ModuleIdentifier
	Version
}

var storeIdentifierRe = regexp.MustCompile(`^(?<module_identifier>[^@]*)@(?<version>[^@]*)$`)

func NewStoreIdentifier(identifier string) StoreIdentifier {
	parts := storeIdentifierRe.FindStringSubmatch(identifier)
	return StoreIdentifier{
		ModuleIdentifier: ModuleIdentifier(parts[1]),
		Version:          Version(parts[2]),
	}
}

func (si *StoreIdentifier) toPath() string {
	return string(si.ModuleIdentifier) + "@" + string(si.Version)
}

func (si *StoreIdentifier) toFilePath() string {
	return filepath.Join(storeFolder, string(si.ModuleIdentifier), string(si.Version))
}
