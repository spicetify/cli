package utils

import (
	"fmt"
	"strconv"
	"strings"
)

// SpotifyVersion is a normalized major.minor.patch Spotify desktop version.
type SpotifyVersion struct {
	Major int
	Minor int
	Patch int
}

// String returns the normalized major.minor.patch form.
func (v SpotifyVersion) String() string {
	return fmt.Sprintf("%d.%d.%d", v.Major, v.Minor, v.Patch)
}

// ClassmapKey encodes the version as used by spicetify/classmaps folders
// (e.g. 1.2.45 -> "1020045", 1.2.93 -> "1020093").
func (v SpotifyVersion) ClassmapKey() string {
	return fmt.Sprintf("%d%02d%04d", v.Major, v.Minor, v.Patch)
}

// ParseSpotifyVersion parses a Spotify version string from prefs or config.
// Accepts forms like "1.2.93", "1.2.93.12.gdeadbeef", and optional leading "v".
func ParseSpotifyVersion(raw string) (SpotifyVersion, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return SpotifyVersion{}, fmt.Errorf("empty Spotify version")
	}
	if strings.HasPrefix(raw, "v") || strings.HasPrefix(raw, "V") {
		raw = raw[1:]
	}

	parts := strings.Split(raw, ".")
	if len(parts) < 3 {
		return SpotifyVersion{}, fmt.Errorf("invalid Spotify version %q: need major.minor.patch", raw)
	}

	major, err := strconv.Atoi(parts[0])
	if err != nil {
		return SpotifyVersion{}, fmt.Errorf("invalid Spotify major version in %q: %w", raw, err)
	}
	minor, err := strconv.Atoi(parts[1])
	if err != nil {
		return SpotifyVersion{}, fmt.Errorf("invalid Spotify minor version in %q: %w", raw, err)
	}
	patch, err := strconv.Atoi(parts[2])
	if err != nil {
		return SpotifyVersion{}, fmt.Errorf("invalid Spotify patch version in %q: %w", raw, err)
	}
	if major < 0 || minor < 0 || patch < 0 {
		return SpotifyVersion{}, fmt.Errorf("invalid Spotify version %q: negative component", raw)
	}

	return SpotifyVersion{Major: major, Minor: minor, Patch: patch}, nil
}

// NormalizeSpotifyVersion returns the major.minor.patch form of raw.
func NormalizeSpotifyVersion(raw string) (string, error) {
	v, err := ParseSpotifyVersion(raw)
	if err != nil {
		return "", err
	}
	return v.String(), nil
}

// CompareSpotifyVersion compares two version strings on major.minor.patch.
// Returns -1 if a < b, 0 if equal, 1 if a > b.
func CompareSpotifyVersion(a, b string) (int, error) {
	va, err := ParseSpotifyVersion(a)
	if err != nil {
		return 0, err
	}
	vb, err := ParseSpotifyVersion(b)
	if err != nil {
		return 0, err
	}
	return va.Compare(vb), nil
}

// Compare returns -1 if v < other, 0 if equal, 1 if v > other.
func (v SpotifyVersion) Compare(other SpotifyVersion) int {
	if v.Major != other.Major {
		if v.Major < other.Major {
			return -1
		}
		return 1
	}
	if v.Minor != other.Minor {
		if v.Minor < other.Minor {
			return -1
		}
		return 1
	}
	if v.Patch != other.Patch {
		if v.Patch < other.Patch {
			return -1
		}
		return 1
	}
	return 0
}

// SpotifyVersionToClassmapKey converts a normalized or full version string
// into a classmap folder key.
func SpotifyVersionToClassmapKey(raw string) (string, error) {
	v, err := ParseSpotifyVersion(raw)
	if err != nil {
		return "", err
	}
	return v.ClassmapKey(), nil
}
