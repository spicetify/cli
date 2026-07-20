package utils

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

// GetInstalledSpotifyVersion reads the version of the installed Spotify
// client directly from the app bundle/binary, avoiding prefs. Prefs lag
// behind real updates (app.last-launched-version is only written after a
// launch) and are empty on fresh installs, so the install itself is the
// most truthful source. Returns "" when it cannot be determined.
func GetInstalledSpotifyVersion(spotifyPath string) string {
	if strings.TrimSpace(spotifyPath) == "" {
		return ""
	}

	var raw string
	switch runtime.GOOS {
	case "darwin":
		raw = darwinInstalledSpotifyVersion(spotifyPath)
	case "windows":
		raw = winInstalledSpotifyVersion(spotifyPath)
	default:
		// Linux has no reliable version file across deb/rpm/snap/flatpak.
		return ""
	}

	if _, err := ParseSpotifyVersion(raw); err != nil {
		return ""
	}
	return raw
}

// darwinInstalledSpotifyVersion reads CFBundleShortVersionString from the
// Spotify.app Info.plist. spotifyPath points inside the bundle
// (usually /Applications/Spotify.app/Contents/Resources).
func darwinInstalledSpotifyVersion(spotifyPath string) string {
	plist := findBundleInfoPlist(spotifyPath)
	if plist == "" {
		return ""
	}

	// PlistBuddy handles XML and binary plists and ships with macOS.
	if buddy, err := exec.LookPath("/usr/libexec/PlistBuddy"); err == nil {
		if out, err := exec.Command(buddy, "-c", "Print :CFBundleShortVersionString", plist).Output(); err == nil {
			if v := strings.TrimSpace(string(out)); v != "" {
				return v
			}
		}
	}

	// Fallback for plain XML plists.
	data, err := os.ReadFile(plist)
	if err != nil {
		return ""
	}
	return parsePlistVersion(data)
}

// findBundleInfoPlist walks up from spotifyPath looking for a .app bundle
// and returns its Contents/Info.plist path, or "".
func findBundleInfoPlist(spotifyPath string) string {
	dir := filepath.Clean(spotifyPath)
	for {
		base := filepath.Base(dir)
		if strings.HasSuffix(base, ".app") {
			plist := filepath.Join(dir, "Contents", "Info.plist")
			if st, err := os.Stat(plist); err == nil && !st.IsDir() {
				return plist
			}
			return ""
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

var plistVersionRe = regexp.MustCompile(`(?s)<key>CFBundleShortVersionString</key>\s*<string>([^<]+)</string>`)

// parsePlistVersion extracts CFBundleShortVersionString from an XML plist.
func parsePlistVersion(data []byte) string {
	m := plistVersionRe.FindSubmatch(data)
	if m == nil {
		return ""
	}
	return strings.TrimSpace(string(m[1]))
}

// winInstalledSpotifyVersion asks PowerShell for the Spotify.exe product
// version (e.g. "1.2.93.478.gabc1234"). Best-effort with a short timeout.
func winInstalledSpotifyVersion(spotifyPath string) string {
	exe := filepath.Join(spotifyPath, "Spotify.exe")
	if st, err := os.Stat(exe); err != nil || st.IsDir() {
		return ""
	}

	ps, err := exec.LookPath("powershell.exe")
	if err != nil {
		return ""
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	out, err := exec.CommandContext(ctx, ps,
		"-NoProfile", "-NonInteractive", "-Command",
		`(Get-Item -LiteralPath '`+strings.ReplaceAll(exe, `'`, `''`)+`').VersionInfo.ProductVersion`,
	).Output()
	if err != nil {
		return ""
	}
	return parseWindowsProductVersion(string(out))
}

// parseWindowsProductVersion trims PowerShell output to a version string.
func parseWindowsProductVersion(out string) string {
	v := strings.TrimSpace(out)
	v = strings.Trim(v, `"'`)
	return v
}
