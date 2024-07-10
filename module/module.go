/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package module

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"spicetify/archive"
	"spicetify/link"
	"spicetify/paths"
	"strings"

	bufra "github.com/avvmoto/buf-readerat"
	"github.com/snabb/httpreaderat"
)

type AURL interface {
	GetMetdata() (Metadata, error)
	install(storeIdentifier StoreIdentifier, checksum string) error
}

type ProviderURL string
type ArtifactURL string
type RemoteArtifactURL string
type RemoteMetadataURL string
type LocalArtifactURL string
type LocalMetadataURL string

func isUrl(str string) bool {
	u, err := url.Parse(str)
	return err == nil && u.Scheme != "" && u.Host != ""
}

func (u ArtifactURL) Parse() AURL {
	if isUrl(string(u)) {
		return RemoteArtifactURL(u)
	}
	return LocalArtifactURL(u)
}

func (u RemoteArtifactURL) GetMetdata() (Metadata, error) {
	b, found := strings.CutSuffix(string(u), ".zip")
	if !found {
		panic("artifact urls must end with .zip")
	}

	murl := RemoteMetadataURL(b + ".metadata.json")

	return fetchRemoteMetadata(murl)
}

func (u RemoteArtifactURL) install(storeIdentifier StoreIdentifier, checksum string) error {
	return downloadModuleToStore(u, storeIdentifier, checksum)
}

func (u LocalArtifactURL) GetMetdata() (Metadata, error) {
	murl := LocalMetadataURL(filepath.Join(string(u), "metadata.json"))

	return fetchLocalMetadata(murl)
}

func (u LocalArtifactURL) install(storeIdentifier StoreIdentifier, checksum string) error {
	return ensureSymlink(string(u), storeIdentifier.toPath())
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

func fetchRemoteMetadata(murl RemoteMetadataURL) (Metadata, error) {
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

func downloadModuleToStore(aurl RemoteArtifactURL, storeIdentifier StoreIdentifier, checksum string) error {
	req, _ := http.NewRequest("GET", string(aurl), nil)

	htrdr, err := httpreaderat.New(nil, req, nil)
	if err != nil {
		panic(err)
	}
	bhtrdr := bufra.NewBufReaderAt(htrdr, 1024*1024)

	zrdr, err := zip.NewReader(bhtrdr, htrdr.Size())
	if err != nil {
		return err
	}

	// TODO: verify checksum
	return archive.UnZip(zrdr, storeIdentifier.toPath())
}

func deleteModuleFromStore(identifier StoreIdentifier) error {
	return os.RemoveAll(identifier.toPath())
}

func AddStoreInVault(storeIdentifier StoreIdentifier, store *Store) error {
	return MutateVault(func(vault *Vault) bool {
		return vault.setStore(storeIdentifier, store)
	})
}

func InstallModule(storeIdentifier StoreIdentifier) error {
	vault, err := GetVault()
	if err != nil {
		return err
	}

	store, ok := vault.getStore(storeIdentifier)
	if !ok {
		return errors.New("Can't find store " + storeIdentifier.toString())
	}

	// TODO: add more options
	aurl := store.Artifacts[0]

	if err := aurl.Parse().install(storeIdentifier, store.Checksum); err != nil {
		return err
	}

	store.Installed = true
	vault.setStore(storeIdentifier, store)
	return SetVault(vault)
}

func EnableModuleInVault(identifier StoreIdentifier) error {
	vault, err := GetVault()
	if err != nil {
		return err
	}

	module := vault.getModule(identifier.ModuleIdentifier)

	if module.Enabled == identifier.Version {
		return nil
	}

	if len(string(identifier.Version)) > 0 {
		if _, ok := module.V[identifier.Version]; !ok {
			return errors.New("Can't find matching " + identifier.toString())
		}
	}

	module.Enabled = identifier.Version
	vault.setModule(identifier.ModuleIdentifier, module)

	if len(string(identifier.ModuleIdentifier)) > 0 {
		destroySymlink(identifier.ModuleIdentifier)
		if len(string(module.Enabled)) > 0 {
			if err := createSymlink(identifier); err != nil {
				return err
			}
		}
	}

	return SetVault(vault)
}

func DeleteModule(identifier StoreIdentifier) error {
	if err := MutateVault(func(vault *Vault) bool {
		module := vault.getModule(identifier.ModuleIdentifier)

		if module.Enabled == identifier.Version {
			module.Enabled = ""
			destroySymlink(identifier.ModuleIdentifier)
		}

		store, ok := module.V[identifier.Version]
		if ok {
			store.Installed = false
		}

		vault.setModule(identifier.ModuleIdentifier, module)
		return true
	}); err != nil {
		return err
	}

	return deleteModuleFromStore(identifier)
}

func RemoveStoreInVault(identifier StoreIdentifier) error {
	return MutateVault(func(vault *Vault) bool {
		module := vault.getModule(identifier.ModuleIdentifier)

		delete(module.V, identifier.Version)
		vault.setModule(identifier.ModuleIdentifier, module)
		return true
	})
}

func ensureSymlink(oldname string, newname string) error {
	if err := os.MkdirAll(filepath.Dir(newname), 0755); err != nil {
		return err
	}
	return link.Create(oldname, newname)
}

func createSymlink(identifier StoreIdentifier) error {
	return ensureSymlink(identifier.toPath(), identifier.ModuleIdentifier.toPath())
}

func destroySymlink(identifier ModuleIdentifier) error {
	return os.Remove(identifier.toPath())
}
