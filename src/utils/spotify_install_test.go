package utils

import "testing"

func TestParsePlistVersion(t *testing.T) {
	xml := `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
	<key>CFBundleName</key>
	<string>Spotify</string>
	<key>CFBundleShortVersionString</key>
	<string>1.2.93.478.gabc12345</string>
	<key>CFBundleVersion</key>
	<string>1.2.93.478</string>
</dict>
</plist>`
	if got := parsePlistVersion([]byte(xml)); got != "1.2.93.478.gabc12345" {
		t.Fatalf("parsePlistVersion = %q", got)
	}

	if got := parsePlistVersion([]byte("<plist><dict></dict></plist>")); got != "" {
		t.Fatalf("missing key should give empty, got %q", got)
	}
}

func TestParseWindowsProductVersion(t *testing.T) {
	cases := map[string]string{
		"1.2.93.478.gabc12345\r\n": "1.2.93.478.gabc12345",
		"\"1.2.92.148\"\n":         "1.2.92.148",
		"  1.2.90  ":               "1.2.90",
		"":                         "",
	}
	for in, want := range cases {
		if got := parseWindowsProductVersion(in); got != want {
			t.Fatalf("parseWindowsProductVersion(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestGetInstalledSpotifyVersionEmptyPath(t *testing.T) {
	if got := GetInstalledSpotifyVersion(""); got != "" {
		t.Fatalf("empty path should give empty version, got %q", got)
	}
	if got := GetInstalledSpotifyVersion("   "); got != "" {
		t.Fatalf("blank path should give empty version, got %q", got)
	}
}
