package utils

import (
	"strconv"
	"strings"
)

// SpotifyVersion holds parsed Spotify version components.
type SpotifyVersion struct {
	Major, Minor, Patch int
}

// ParseSpotifyVersion parses a dotted version string like "1.2.57"
// into its major, minor, and patch components. Missing or invalid
// parts default to 0.
func ParseSpotifyVersion(ver string) SpotifyVersion {
	ver = strings.TrimPrefix(ver, "v")
	parts := strings.Split(ver, ".")
	v := SpotifyVersion{}
	if len(parts) > 0 {
		v.Major, _ = strconv.Atoi(parts[0])
	}
	if len(parts) > 1 {
		v.Minor, _ = strconv.Atoi(parts[1])
	}
	if len(parts) > 2 {
		v.Patch, _ = strconv.Atoi(parts[2])
	}
	return v
}

// AtLeast returns true if v is greater than or equal to the given version.
func (v SpotifyVersion) AtLeast(major, minor, patch int) bool {
	if v.Major != major {
		return v.Major > major
	}
	if v.Minor != minor {
		return v.Minor > minor
	}
	return v.Patch >= patch
}
