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

// SupportList is the on-disk schema for supported-versions.json.
// Schema v1 is the plain allowlist; schema v2 adds classmap metadata.
type SupportList struct {
	SchemaVersion int               `json:"schema_version"`
	Updated       string            `json:"updated,omitempty"`
	Policy        string            `json:"policy"`
	Versions      []string          `json:"versions"`
	Ranges        []SupportRange    `json:"ranges"`
	Notes         map[string]string `json:"notes,omitempty"`
	// DefaultMapStatus applies to allowlisted versions without a maps entry.
	// Defaults to "classic" when empty. Schema v2 only.
	DefaultMapStatus ClassmapStatus `json:"default_map_status,omitempty"`
	// Maps holds optional per-version classmap metadata, keyed by
	// normalized major.minor.patch (e.g. "1.2.93"). Schema v2 only.
	Maps map[string]ClassmapInfo `json:"maps,omitempty"`
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

// LoadSupportedVersions reads and validates a support list file.
// Accepts schema_version 1 (plain allowlist) and 2 (classmap-aware).
func LoadSupportedVersions(path string) (*SupportList, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read supported versions list at %s: %w", path, err)
	}

	var list SupportList
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("supported versions list is malformed (%s): %w", path, err)
	}

	if list.SchemaVersion != 1 && list.SchemaVersion != 2 {
		return nil, fmt.Errorf("unsupported supported-versions schema_version %d (want 1 or 2)", list.SchemaVersion)
	}
	if list.Policy != "" && list.Policy != "allowlist" {
		return nil, fmt.Errorf("unsupported supported-versions policy %q (want allowlist)", list.Policy)
	}
	if list.Policy == "" {
		list.Policy = "allowlist"
	}
	if list.DefaultMapStatus == "" {
		list.DefaultMapStatus = ClassmapStatusClassic
	}
	if err := ValidateClassmapStatus(list.DefaultMapStatus); err != nil {
		return nil, fmt.Errorf("default_map_status: %w", err)
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

	if list.Maps == nil {
		list.Maps = map[string]ClassmapInfo{}
	}
	normalizedMaps := make(map[string]ClassmapInfo, len(list.Maps))
	for key, info := range list.Maps {
		normalized, err := NormalizeSpotifyVersion(key)
		if err != nil {
			return nil, fmt.Errorf("invalid maps key %q: %w", key, err)
		}
		if _, dup := normalizedMaps[normalized]; dup {
			return nil, fmt.Errorf("maps keys normalize to duplicate version %q", normalized)
		}
		if info.Status == "" {
			info.Status = list.DefaultMapStatus
		}
		if err := ValidateClassmapStatus(info.Status); err != nil {
			return nil, fmt.Errorf("maps[%s].status: %w", normalized, err)
		}
		if info.ClassmapKey == "" {
			info.ClassmapKey, err = SpotifyVersionToClassmapKey(normalized)
			if err != nil {
				return nil, fmt.Errorf("maps[%s].classmap_key: %w", normalized, err)
			}
		}
		normalizedMaps[normalized] = info
	}
	list.Maps = normalizedMaps

	return &list, nil
}

// IsSupported reports whether normalized major.minor.patch is allowlisted.
// NewestSupported returns the newest version that ships a verified modular
// classmap (the v3 module stack's definition of "supported"), or "" when the
// list has none. This is the single local source of truth for the gate's
// supportedSpotify: deriving it from the shipped classmaps rather than a
// separate feed field means the hard version gate and the update gate cannot
// drift apart.
func (s *SupportList) NewestSupported() string {
	if s == nil {
		return ""
	}
	newest := ""
	for ver, info := range s.Maps {
		if info.Status != ClassmapStatusModular {
			continue
		}
		if newest == "" {
			newest = ver
			continue
		}
		if cmp, err := CompareSpotifyVersion(ver, newest); err == nil && cmp > 0 {
			newest = ver
		}
	}
	return newest
}

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

// MapInfoFor returns classmap metadata for a normalized version.
// ClassmapKey is always filled when the version parses.
func (s *SupportList) MapInfoFor(normalized string) (ClassmapInfo, error) {
	v, err := ParseSpotifyVersion(normalized)
	if err != nil {
		return ClassmapInfo{}, err
	}
	normalized = v.String()
	key := v.ClassmapKey()

	if s != nil {
		if info, ok := s.Maps[normalized]; ok {
			if info.ClassmapKey == "" {
				info.ClassmapKey = key
			}
			if info.Status == "" {
				info.Status = s.DefaultMapStatus
				if info.Status == "" {
					info.Status = ClassmapStatusClassic
				}
			}
			return info, nil
		}
	}

	status := ClassmapStatusNone
	if s != nil && s.IsSupported(normalized) {
		status = s.DefaultMapStatus
		if status == "" {
			status = ClassmapStatusClassic
		}
	}

	return ClassmapInfo{
		ClassmapKey: key,
		Status:      status,
	}, nil
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
