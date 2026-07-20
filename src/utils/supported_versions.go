package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// SupportedVersionsFileName is the support list file shipped next to the binary.
const SupportedVersionsFileName = "supported-versions.json"

// SupportRange is an inclusive major.minor.patch range.
type SupportRange struct {
	Min  string `json:"min"`
	Max  string `json:"max"`
	Note string `json:"note,omitempty"`
}

// SupportList is the on-disk schema for supported-versions.json (schema v1).
type SupportList struct {
	SchemaVersion int               `json:"schema_version"`
	Updated       string            `json:"updated,omitempty"`
	Policy        string            `json:"policy"`
	Versions      []string          `json:"versions"`
	Ranges        []SupportRange    `json:"ranges"`
	Notes         map[string]string `json:"notes,omitempty"`
}

// DefaultSupportedVersionsPath returns the path next to the executable,
// matching how css-map.json is resolved.
func DefaultSupportedVersionsPath() string {
	return filepath.Join(GetExecutableDir(), SupportedVersionsFileName)
}

// SupportedVersionsSearchPaths returns locations checked for the support
// list, in priority order: next to the binary (release installs), then the
// Spicetify config folder (package-manager and go installs).
func SupportedVersionsSearchPaths() []string {
	paths := []string{
		DefaultSupportedVersionsPath(),
		filepath.Join(GetSpicetifyFolder(), SupportedVersionsFileName),
	}
	seen := map[string]bool{}
	out := make([]string, 0, len(paths))
	for _, p := range paths {
		if p == "" || seen[p] {
			continue
		}
		seen[p] = true
		out = append(out, p)
	}
	return out
}

// FindSupportedVersionsFileIn returns the first existing support list under
// the given paths, in order.
func FindSupportedVersionsFileIn(paths []string) (string, error) {
	for _, p := range paths {
		if p == "" {
			continue
		}
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p, nil
		}
	}
	return "", fmt.Errorf("no %s found (searched %s)", SupportedVersionsFileName, strings.Join(paths, ", "))
}

// FindSupportedVersionsFile resolves the support list across the default
// search paths.
func FindSupportedVersionsFile() (string, error) {
	return FindSupportedVersionsFileIn(SupportedVersionsSearchPaths())
}

// LoadSupportedVersions reads and validates a schema v1 support list file.
func LoadSupportedVersions(path string) (*SupportList, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read supported versions list at %s: %w", path, err)
	}

	var list SupportList
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("supported versions list is malformed (%s): %w", path, err)
	}

	if list.SchemaVersion != 1 {
		return nil, fmt.Errorf("unsupported supported-versions schema_version %d (want 1)", list.SchemaVersion)
	}
	if list.Policy != "" && list.Policy != "allowlist" {
		return nil, fmt.Errorf("unsupported supported-versions policy %q (want allowlist)", list.Policy)
	}
	if list.Policy == "" {
		list.Policy = "allowlist"
	}

	for i, v := range list.Versions {
		normalized, err := NormalizeSpotifyVersion(v)
		if err != nil {
			return nil, fmt.Errorf("invalid versions[%d] %q: %w", i, v, err)
		}
		list.Versions[i] = normalized
	}

	for i, r := range list.Ranges {
		min, err := NormalizeSpotifyVersion(r.Min)
		if err != nil {
			return nil, fmt.Errorf("invalid ranges[%d].min %q: %w", i, r.Min, err)
		}
		max, err := NormalizeSpotifyVersion(r.Max)
		if err != nil {
			return nil, fmt.Errorf("invalid ranges[%d].max %q: %w", i, r.Max, err)
		}
		if cmp, err := CompareSpotifyVersion(min, max); err != nil {
			return nil, err
		} else if cmp > 0 {
			return nil, fmt.Errorf("invalid ranges[%d]: min %s is greater than max %s", i, min, max)
		}
		list.Ranges[i].Min = min
		list.Ranges[i].Max = max
	}

	return &list, nil
}

// IsSupported reports whether normalized major.minor.patch is allowlisted.
func (s *SupportList) IsSupported(normalized string) bool {
	if s == nil {
		return false
	}

	v, err := ParseSpotifyVersion(normalized)
	if err != nil {
		return false
	}
	normalized = v.String()

	for _, exact := range s.Versions {
		if exact == normalized {
			return true
		}
	}

	for _, r := range s.Ranges {
		minCmp, err := CompareSpotifyVersion(normalized, r.Min)
		if err != nil {
			continue
		}
		maxCmp, err := CompareSpotifyVersion(normalized, r.Max)
		if err != nil {
			continue
		}
		if minCmp >= 0 && maxCmp <= 0 {
			return true
		}
	}

	return false
}

// CheckSupported returns nil when the version is allowlisted, or a
// descriptive error when it is not. Kept exit-free so it is unit-testable.
func (s *SupportList) CheckSupported(raw string) error {
	normalized, err := NormalizeSpotifyVersion(raw)
	if err != nil {
		return fmt.Errorf("cannot parse Spotify version %q: %w", raw, err)
	}
	if !s.IsSupported(normalized) {
		return fmt.Errorf("Spotify %s (%s) is not supported by this Spicetify release", raw, normalized)
	}
	return nil
}

// SupportedSummary returns a compact human-readable list of supported versions.
// Uses ASCII "-" between range edges so output is safe on Windows codepages,
// and sorts by parsed version (not lexicographically) so 1.2.100 sorts after 1.2.93.
func (s *SupportList) SupportedSummary() string {
	if s == nil {
		return "(none)"
	}

	type entry struct {
		key  SpotifyVersion
		text string
	}
	entries := make([]entry, 0, len(s.Versions)+len(s.Ranges))
	for _, v := range s.Versions {
		parsed, err := ParseSpotifyVersion(v)
		if err != nil {
			continue
		}
		entries = append(entries, entry{key: parsed, text: v})
	}
	for _, r := range s.Ranges {
		parsed, err := ParseSpotifyVersion(r.Min)
		if err != nil {
			continue
		}
		text := r.Min
		if r.Min != r.Max {
			text = fmt.Sprintf("%s-%s", r.Min, r.Max)
		}
		entries = append(entries, entry{key: parsed, text: text})
	}

	if len(entries) == 0 {
		return "(none listed)"
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].key.Compare(entries[j].key) < 0
	})
	parts := make([]string, 0, len(entries))
	for _, e := range entries {
		parts = append(parts, e.text)
	}
	return strings.Join(parts, ", ")
}
