package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// SupportRange is an inclusive major.minor.patch range.
type SupportRange struct {
	Min  string `json:"min"`
	Max  string `json:"max"`
	Note string `json:"note,omitempty"`
}

// SupportList is the on-disk schema for supported-versions.json.
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
	return filepath.Join(GetExecutableDir(), "supported-versions.json")
}

// LoadSupportedVersions reads and validates a support list file.
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

// SupportedSummary returns a compact human-readable list of supported versions.
func (s *SupportList) SupportedSummary() string {
	if s == nil {
		return "(none)"
	}

	parts := make([]string, 0, len(s.Versions)+len(s.Ranges))
	parts = append(parts, s.Versions...)
	for _, r := range s.Ranges {
		if r.Min == r.Max {
			parts = append(parts, r.Min)
		} else {
			parts = append(parts, fmt.Sprintf("%s–%s", r.Min, r.Max))
		}
	}

	if len(parts) == 0 {
		return "(none listed)"
	}

	sort.Strings(parts)
	return strings.Join(parts, ", ")
}
