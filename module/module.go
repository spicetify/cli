/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package module

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"spicetify/archive"
	"spicetify/paths"
	"strings"
)

type ArtifactURL string
type MetadataURL string
type LocalMetadataURL string

func (a ArtifactURL) getMetdataURL() MetadataURL {
	b, found := strings.CutSuffix(string(a), ".zip")
	if !found {
		panic("artifact urls must end with .zip")
	}
	return MetadataURL(b + ".metadata.json")
}

var modulesFolder = filepath.Join(paths.ConfigPath, "modules")
var storeFolder = filepath.Join(paths.ConfigPath, "store")
var vaultPath = filepath.Join(modulesFolder, "vault.json")

func parseMetadata(r io.Reader) (Metadata, error) {
	var metadata Metadata
	if err := json.NewDecoder(r).Decode(&metadata); err != nil {
		return Metadata{}, err
	}
	return metadata, nil
}

func fetchRemoteMetadata(murl MetadataURL) (Metadata, error) {
	res, err := http.Get(string(murl))
	if err != nil {
		return Metadata{}, err
	}
	defer res.Body.Close()

	return parseMetadata(res.Body)
}

func fetchLocalMetadata(murl LocalMetadataURL) (Metadata, error) {
	file, err := os.Open(string(murl))
	if err != nil {
		return Metadata{}, err
	}
	defer file.Close()

	return parseMetadata(file)
}

func downloadModuleInStore(aurl ArtifactURL, storeIdentifier StoreIdentifier) error {
	res, err := http.Get(string(aurl))
	if err != nil {
		return err
	}
	defer res.Body.Close()

	return archive.UnTarGZ(res.Body, storeIdentifier.toFilePath())
}

func deleteModuleInStore(identifier StoreIdentifier) error {
	return os.RemoveAll(identifier.toFilePath())
}

func AddModuleInVault(metadata *Metadata, module *Store) error {
	return MutateVault(func(vault *Vault) bool {
		return vault.setStore(metadata.getStoreIdentifier(), module)
	})
}

func ToggleModuleInVault(identifier StoreIdentifier) error {
	vault, err := GetVault()
	if err != nil {
		return err
	}

	module := vault.getModule(identifier.ModuleIdentifier.toPath())

	if module.Enabled == identifier.Version {
		return nil
	}

	if len(string(identifier.Version)) > 0 {
		if _, ok := module.V[identifier.Version]; !ok {
			return errors.New("Can't find matching " + identifier.toPath())
		}
	}

	module.Enabled = identifier.Version
	vault.setModule(identifier.ModuleIdentifier.toPath(), module)

	destroySymlink(identifier.ModuleIdentifier)
	if len(module.Enabled) > 0 {
		if err := createSymlink(identifier); err != nil {
			return err
		}
	}

	return SetVault(vault)
}

func RemoveModuleInVault(identifier StoreIdentifier) error {
	return MutateVault(func(vault *Vault) bool {
		module := vault.getModule(identifier.ModuleIdentifier.toPath())

		if module.Enabled == identifier.Version {
			module.Enabled = ""
			destroySymlink(identifier.ModuleIdentifier)
		}

		delete(module.V, identifier.Version)
		vault.setModule(identifier.ModuleIdentifier.toPath(), module)
		return true
	})
}

func InstallRemoteModule(aurl ArtifactURL) error {
	metadata, err := fetchRemoteMetadata(aurl.getMetdataURL())
	if err != nil {
		return err
	}

	storeIdentifier := metadata.getStoreIdentifier()

	err = downloadModuleInStore(aurl, storeIdentifier)
	if err != nil {
		return err
	}

	return AddModuleInVault(&metadata, &Store{
		Installed: true,
		Artifacts: []ArtifactURL{aurl},
	})
}

func InstallLocalModule(murl LocalMetadataURL) error {
	metadata, err := fetchLocalMetadata(murl)
	if err != nil {
		return err
	}

	storeIdentifier := metadata.getStoreIdentifier()
	if err := ensureSymlink(filepath.Dir(string(murl)), storeIdentifier.toFilePath()); err != nil {
		return err
	}

	return AddModuleInVault(&metadata, &Store{
		Installed: true,
		Artifacts: []ArtifactURL{},
	})
}

func DeleteModule(identifier StoreIdentifier) error {
	if err := RemoveModuleInVault(identifier); err != nil {
		return err
	}
	return deleteModuleInStore(identifier)
}

func ensureSymlink(oldname string, newname string) error {
	if err := os.MkdirAll(filepath.Dir(newname), 0755); err != nil {
		return err
	}
	return os.Symlink(oldname, newname)
}

func createSymlink(identifier StoreIdentifier) error {
	return ensureSymlink(identifier.toFilePath(), identifier.ModuleIdentifier.toFilePath())
}

func destroySymlink(identifier ModuleIdentifier) error {
	return os.Remove(identifier.toFilePath())
}
