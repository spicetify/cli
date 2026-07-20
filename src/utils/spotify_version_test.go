package utils

import "testing"

func TestParseAndNormalizeSpotifyVersion(t *testing.T) {
	tests := []struct {
		raw     string
		want    string
		wantErr bool
	}{
		{"1.2.93", "1.2.93", false},
		{"1.2.93.12.gdeadbeef", "1.2.93", false},
		{"v1.2.45", "1.2.45", false},
		{" 1.2.86 ", "1.2.86", false},
		{"", "", true},
		{"1.2", "", true},
		{"foo", "", true},
		{"1.2.x", "", true},
	}

	for _, tt := range tests {
		got, err := NormalizeSpotifyVersion(tt.raw)
		if tt.wantErr {
			if err == nil {
				t.Fatalf("NormalizeSpotifyVersion(%q) expected error, got %q", tt.raw, got)
			}
			continue
		}
		if err != nil {
			t.Fatalf("NormalizeSpotifyVersion(%q) unexpected error: %v", tt.raw, err)
		}
		if got != tt.want {
			t.Fatalf("NormalizeSpotifyVersion(%q) = %q, want %q", tt.raw, got, tt.want)
		}
	}
}

func TestSpotifyVersionClassmapKey(t *testing.T) {
	tests := []struct {
		raw  string
		want string
	}{
		{"1.2.45", "1020045"},
		{"1.2.93", "1020093"},
		{"1.2.8", "1020008"},
		{"1.2.38", "1020038"},
	}

	for _, tt := range tests {
		got, err := SpotifyVersionToClassmapKey(tt.raw)
		if err != nil {
			t.Fatalf("SpotifyVersionToClassmapKey(%q): %v", tt.raw, err)
		}
		if got != tt.want {
			t.Fatalf("SpotifyVersionToClassmapKey(%q) = %q, want %q", tt.raw, got, tt.want)
		}
	}
}

func TestCompareSpotifyVersion(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		{"1.2.86", "1.2.86", 0},
		{"1.2.86", "1.2.93", -1},
		{"1.2.93", "1.2.86", 1},
		{"1.2.93.9.gabc", "1.2.93", 0},
		{"1.1.99", "1.2.0", -1},
	}

	for _, tt := range tests {
		got, err := CompareSpotifyVersion(tt.a, tt.b)
		if err != nil {
			t.Fatalf("CompareSpotifyVersion(%q, %q): %v", tt.a, tt.b, err)
		}
		if got != tt.want {
			t.Fatalf("CompareSpotifyVersion(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
		}
	}
}
