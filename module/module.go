/* Copyright © 2024
 *      Delusoire <deluso7re@outlook.com>
 *
 * This file is part of bespoke/cli.
 *
 * bespoke/cli is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * bespoke/cli is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with bespoke/cli. If not, see <https://www.gnu.org/licenses/>.
 */

package module

import (
	"bespoke/archive"
	"bespoke/paths"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"slices"

	"github.com/google/go-github/github"
)

var client = github.NewClient(nil)

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
	return ModuleIdentifier{
		Author: Author(m.getAuthor()),
		Name:   Name(m.Name),
	}
}

func (m *Metadata) getStoreIdentifier() StoreIdentifier {
	return StoreIdentifier{
		ModuleIdentifier: m.getModuleIdentifier(),
		Version:          Version(m.Version),
	}
}

type GithubPathVersion struct {
	__type string
	commit string
	tag    string
	branch string
}

type VersionedGithubPath struct {
	owner   string
	repo    string
	version GithubPathVersion
	path    string
}

var githubRawRe = regexp.MustCompile(`https://raw.githubusercontent.com/(?<owner>[^/]+)/(?<repo>[^/]+)/(?<version>[^/]+)/(?<dirname>.*?)/?(?<basename>[^/])+$`)

func (ghp VersionedGithubPath) getRepoArchiveLink() string {
	url := "https://github.com/" + ghp.owner + "/" + ghp.repo + "/archive/"

	switch ghp.version.__type {
	case "commit":
		url += ghp.version.commit

	case "tag":
		url += "refs/tags/" + ghp.version.tag

	case "branch":
		url += "refs/heads/" + ghp.version.branch

	}

	url += ".tar.gz"

	return url
}

type Store struct {
	Installed bool        `json:"installed"`
	Metadatas []RemoteURL `json:"metadatas"`
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

// https://raw.githubusercontent.com/<owner>/<repo>/<branch|tag|commit>/path/to/module/metadata.json
type RemoteURL = string
type LocalURL = string

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

var modulesFolder = filepath.Join(paths.ConfigPath, "modules")
var storeFolder = filepath.Join(paths.ConfigPath, "store")
var vaultPath = filepath.Join(modulesFolder, "vault.json")

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

func parseMetadata(r io.Reader) (Metadata, error) {
	var metadata Metadata
	if err := json.NewDecoder(r).Decode(&metadata); err != nil {
		return Metadata{}, err
	}
	return metadata, nil
}

func fetchRemoteMetadata(metadataURL RemoteURL) (Metadata, error) {
	res, err := http.Get(metadataURL)
	if err != nil {
		return Metadata{}, err
	}
	defer res.Body.Close()

	return parseMetadata(res.Body)
}

func fetchLocalMetadata(metadataURL LocalURL) (Metadata, error) {
	file, err := os.Open(metadataURL)
	if err != nil {
		return Metadata{}, err
	}
	defer file.Close()

	return parseMetadata(file)
}

func parseGithubRawLink(metadataURL RemoteURL) (VersionedGithubPath, error) {

	submatches := githubRawRe.FindStringSubmatch(metadataURL)
	if submatches == nil {
		return VersionedGithubPath{}, errors.New("URL cannot be parsed")
	}

	owner := submatches[1]
	repo := submatches[2]
	v := submatches[3]
	path := submatches[4]

	branches, _, err := client.Repositories.ListBranches(context.Background(), owner, repo, &github.ListOptions{})
	if err != nil {
		return VersionedGithubPath{}, err
	}

	branchNames := []string{}

	for branch := range branches {
		branchNames = append(branchNames, branches[branch].GetName())
	}

	var version GithubPathVersion
	if len(v) == 40 {
		version = GithubPathVersion{
			__type: "commit",
			commit: v,
		}
	} else if slices.Contains(branchNames, v) {
		version = GithubPathVersion{
			__type: "branch",
			branch: v,
		}
	} else {
		tag, err := url.QueryUnescape(v)
		if err != nil {
			return VersionedGithubPath{}, err
		}

		version = GithubPathVersion{
			__type: "tag",
			tag:    tag,
		}
	}

	return VersionedGithubPath{
		owner,
		repo,
		version,
		path,
	}, nil
}

func downloadModuleInStore(metadataURL RemoteURL, storeIdentifier StoreIdentifier) error {
	githubPath, err := parseGithubRawLink(metadataURL)
	if err != nil {
		return err
	}

	res, err := http.Get(githubPath.getRepoArchiveLink())
	if err != nil {
		return err
	}
	defer res.Body.Close()

	srcRe := regexp.MustCompile(`^[^/]+/` + githubPath.path + "(.*)")

	return archive.UnTarGZ(res.Body, srcRe, storeIdentifier.toFilePath())
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

func InstallModuleRemote(metadataURL RemoteURL) error {
	metadata, err := fetchRemoteMetadata(metadataURL)
	if err != nil {
		return err
	}

	storeIdentifier := metadata.getStoreIdentifier()

	err = downloadModuleInStore(metadataURL, storeIdentifier)
	if err != nil {
		return err
	}

	return AddModuleInVault(&metadata, &Store{
		Installed: true,
		Metadatas: []string{metadataURL},
	})
}

func InstallModuleLocal(metadataURL LocalURL) error {
	metadata, err := fetchLocalMetadata(metadataURL)
	if err != nil {
		return err
	}

	storeIdentifier := metadata.getStoreIdentifier()
	if err := ensureSymlink(filepath.Dir(metadataURL), storeIdentifier.toFilePath()); err != nil {
		return err
	}

	return AddModuleInVault(&metadata, &Store{
		Installed: true,
		Metadatas: []string{},
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
