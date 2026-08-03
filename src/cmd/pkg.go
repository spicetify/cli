package cmd

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/spicetify/cli/src/utils"
)

// ModuleVaultURL is the default v3 module vault.
const ModuleVaultURL = "https://raw.githubusercontent.com/spicetify/modules/main/vault.json"

// CommunityVaultsURL lists org-vetted community module vaults.
const CommunityVaultsURL = "https://raw.githubusercontent.com/spicetify/modules/main/community-vaults.json"

type communityVault struct {
	Name        string `json:"name"`
	URL         string `json:"url"`
	Description string `json:"description"`
}

func fetchCommunityVaults() ([]communityVault, error) {
	resp, err := http.Get(CommunityVaultsURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("community vaults returned HTTP %d", resp.StatusCode)
	}
	var vaults []communityVault
	if err := json.NewDecoder(resp.Body).Decode(&vaults); err != nil {
		return nil, err
	}
	return vaults, nil
}

// vaultURLs returns the default vault plus any custom vaults configured in
// the [Module] section (vault_urls, |-separated).
func vaultURLs() []string {
	urls := []string{ModuleVaultURL}
	if moduleSection != nil {
		for _, u := range moduleSection.Key("vault_urls").Strings("|") {
			if u != "" {
				urls = append(urls, u)
			}
		}
	}
	return urls
}

type vaultVersion struct {
	Artifacts []string `json:"artifacts"`
	Checksum  string   `json:"checksum,omitempty"`
}

type vaultModule struct {
	Enabled string                  `json:"enabled"`
	V       map[string]vaultVersion `json:"v"`
}

type vault struct {
	Modules map[string]vaultModule `json:"modules"`
}

// ModulePkg implements `spicetify pkg list|install|delete`.
func ModulePkg(args []string) {
	if len(args) == 0 {
		utils.PrintError("usage: spicetify pkg <list|install <id>|delete <id>>")
		os.Exit(1)
	}

	switch args[0] {
	case "list":
		pkgList()
	case "sources":
		pkgSources()
	case "trust":
		if len(args) < 2 {
			utils.PrintError("usage: spicetify pkg trust <name|url>")
			os.Exit(1)
		}
		pkgTrust(args[1])
	case "install":
		if len(args) < 2 {
			utils.PrintError("usage: spicetify pkg install <id>")
			os.Exit(1)
		}
		pkgInstall(args[1])
	case "delete":
		if len(args) < 2 {
			utils.PrintError("usage: spicetify pkg delete <id>")
			os.Exit(1)
		}
		pkgDelete(args[1])
	default:
		utils.PrintError("unknown pkg command: " + args[0])
		os.Exit(1)
	}
}

func fetchVault(url string) (*vault, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("cannot fetch vault: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("vault returned HTTP %d", resp.StatusCode)
	}
	var v vault
	if err := json.NewDecoder(resp.Body).Decode(&v); err != nil {
		return nil, fmt.Errorf("vault is malformed: %w", err)
	}
	return &v, nil
}

func resolveVersion(m vaultModule) (string, error) {
	if m.Enabled != "" {
		if _, ok := m.V[m.Enabled]; ok {
			return m.Enabled, nil
		}
		return "", fmt.Errorf("enabled version %q not in vault", m.Enabled)
	}
	if len(m.V) == 0 {
		return "", fmt.Errorf("no versions in vault")
	}
	versions := make([]string, 0, len(m.V))
	for v := range m.V {
		versions = append(versions, v)
	}
	sort.Strings(versions)
	return versions[len(versions)-1], nil
}

func pkgList() {
	for _, vaultURL := range vaultURLs() {
		v, err := fetchVault(vaultURL)
		if err != nil {
			utils.PrintWarning("cannot fetch vault " + vaultURL + ": " + err.Error())
			continue
		}
		pkgListVault(v, vaultURL)
	}
}

func pkgListVault(v *vault, vaultURL string) {

	installed := map[string]string{}
	if modules, err := utils.DiscoverModules(utils.ModulesDir()); err == nil {
		for _, m := range modules {
			installed[m.Identifier] = m.Version
		}
	}
	if entries, err := os.ReadDir(utils.ModulesDir()); err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			var sc struct {
				InstalledVersion string `json:"installed_version"`
			}
			if raw, err := os.ReadFile(filepath.Join(utils.ModulesDir(), e.Name(), "spicetify-module.json")); err == nil {
				if json.Unmarshal(raw, &sc) == nil && sc.InstalledVersion != "" {
					installed[e.Name()] = sc.InstalledVersion
				}
			}
		}
	}

	if len(vaultURLs()) > 1 {
		utils.PrintBold("vault: " + vaultURL)
	} else {
		utils.PrintBold("vault modules")
	}
	ids := make([]string, 0, len(v.Modules))
	for id := range v.Modules {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	for _, id := range ids {
		m := v.Modules[id]
		version, _ := resolveVersion(m)
		line := fmt.Sprintf("  %s (%s)", id, version)
		if iv, ok := installed[id]; ok {
			line += fmt.Sprintf(" — installed (%s)", iv)
		}
		fmt.Println(line)
	}
	fmt.Println()
}

func pkgInstall(identifier string) {
	var m vaultModule
	var version string
	for _, vaultURL := range vaultURLs() {
		v, err := fetchVault(vaultURL)
		if err != nil {
			utils.PrintWarning("cannot fetch vault " + vaultURL + ": " + err.Error())
			continue
		}
		mod, ok := v.Modules[identifier]
		if !ok {
			continue
		}
		resolved, err := resolveVersion(mod)
		if err != nil {
			utils.PrintError(err.Error())
			os.Exit(1)
		}
		if len(mod.V[resolved].Artifacts) == 0 {
			continue
		}
		m, version = mod, resolved
		utils.PrintInfo("Found " + identifier + "@" + version + " in vault " + vaultURL)
		break
	}
	if version == "" {
		utils.PrintError("module not found in any vault: " + identifier)
		os.Exit(1)
	}
	artifacts := m.V[version].Artifacts
	if len(artifacts) == 0 {
		utils.PrintError("no artifacts for " + identifier + "@" + version)
		os.Exit(1)
	}

	spinner, _ := utils.Spinner.Start(fmt.Sprintf("Downloading %s@%s", identifier, version))
	zipPath := filepath.Join(os.TempDir(), fmt.Sprintf("spicetify-pkg-%s.zip", identifier))
	out, err := os.Create(zipPath)
	if err != nil {
		spinner.Fail("Download failed")
		utils.Fatal(err)
	}
	resp, err := http.Get(artifacts[0])
	if err != nil {
		out.Close()
		spinner.Fail("Download failed")
		utils.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		out.Close()
		spinner.Fail("Download failed")
		utils.Fatal(fmt.Errorf("artifact returned HTTP %d", resp.StatusCode))
	}
	if _, err := io.Copy(out, resp.Body); err != nil {
		out.Close()
		spinner.Fail("Download failed")
		utils.Fatal(err)
	}
	out.Close()
	spinner.Success("Downloaded " + identifier + "@" + version)

	declared := m.V[version].Checksum
	if err := verifyChecksum(zipPath, declared); err != nil {
		os.Remove(zipPath)
		utils.Fatal(err)
	}

	dest := filepath.Join(utils.ModulesDir(), identifier)
	if err := os.RemoveAll(dest); err != nil {
		utils.Fatal(err)
	}
	if err := os.MkdirAll(dest, 0755); err != nil {
		utils.Fatal(err)
	}
	if err := utils.Unzip(zipPath, dest); err != nil {
		utils.Fatal(fmt.Errorf("cannot extract module: %w", err))
	}

	sidecar := map[string]any{
		"installed_version": version,
		"classmap_base":     "",
		"allow_stale":       false,
		"checksum":          m.V[version].Checksum,
	}
	raw, _ := json.MarshalIndent(sidecar, "", "  ")
	if err := os.WriteFile(filepath.Join(dest, "spicetify-module.json"), raw, 0644); err != nil {
		utils.Fatal(err)
	}

	utils.PrintSuccess(fmt.Sprintf("Installed %s@%s to %s", identifier, version, dest))
}

// verifyChecksum checks the artifact against the vault-declared checksum.
// Missing declarations warn and proceed (unsigned); mismatches are fatal.
func verifyChecksum(zipPath, declared string) error {
	if declared == "" {
		utils.PrintWarning("No checksum declared in the vault; installing unverified artifact")
		return nil
	}
	raw, err := os.ReadFile(zipPath)
	if err != nil {
		return err
	}
	got := fmt.Sprintf("sha256:%x", sha256.Sum256(raw))
	want := strings.ToLower(strings.TrimSpace(declared))
	if !strings.HasPrefix(want, "sha256:") {
		want = "sha256:" + want
	}
	if got != want {
		return fmt.Errorf("checksum mismatch for %s: vault declares %s, download is %s", filepath.Base(zipPath), want, got)
	}
	utils.PrintInfo("Checksum verified: " + got)
	return nil
}

func pkgSources() {
	vaults, err := fetchCommunityVaults()
	if err != nil {
		utils.PrintError("cannot fetch community vaults: " + err.Error())
		os.Exit(1)
	}
	trusted := map[string]bool{}
	for _, u := range vaultURLs() {
		trusted[u] = true
	}
	utils.PrintBold("community vaults")
	for _, v := range vaults {
		mark := "  "
		if trusted[v.URL] {
			mark = "* "
		}
		fmt.Printf("%s%s (%s)\n    %s\n", mark, v.Name, v.URL, v.Description)
	}
	fmt.Println()
	fmt.Println("  * = trusted. Trust one with: spicetify pkg trust <name>")
}

func pkgTrust(nameOrURL string) {
	url := nameOrURL
	if !strings.HasPrefix(url, "http") {
		vaults, err := fetchCommunityVaults()
		if err != nil {
			utils.PrintError("cannot fetch community vaults: " + err.Error())
			os.Exit(1)
		}
		url = ""
		for _, v := range vaults {
			if v.Name == nameOrURL {
				url = v.URL
				break
			}
		}
		if url == "" {
			utils.PrintError("unknown community vault: " + nameOrURL)
			os.Exit(1)
		}
	}

	for _, u := range vaultURLs() {
		if u == url {
			utils.PrintInfo("Already trusted: " + url)
			return
		}
	}
	key := moduleSection.Key("vault_urls")
	current := strings.TrimSpace(key.String())
	if current == "" {
		key.SetValue(url)
	} else {
		key.SetValue(current + "|" + url)
	}
	if err := cfg.Write(); err != nil {
		utils.Fatal(err)
	}
	utils.PrintSuccess("Trusted " + url)
}

func pkgDelete(identifier string) {
	dest := filepath.Join(utils.ModulesDir(), identifier)
	if _, err := os.Stat(dest); err != nil {
		utils.PrintError("module not installed: " + identifier)
		os.Exit(1)
	}
	if err := os.RemoveAll(dest); err != nil {
		utils.Fatal(err)
	}
	utils.PrintSuccess("Deleted " + identifier)
}
