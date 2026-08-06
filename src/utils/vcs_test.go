package utils

import "testing"

func TestLatestV3Tag(t *testing.T) {
	cases := []struct {
		name     string
		releases []GithubRelease
		want     string
	}{
		{
			name:     "no v3 release yet",
			releases: []GithubRelease{{TagName: "v2.44.0"}, {TagName: "v2.43.2"}},
			want:     "",
		},
		{
			name:     "picks the newest v3, which GitHub lists first",
			releases: []GithubRelease{{TagName: "v3.0.0-beta.2"}, {TagName: "v3.0.0-beta.1"}, {TagName: "v2.44.0"}},
			want:     "v3.0.0-beta.2",
		},
		{
			name:     "skips newer v2 releases to find v3",
			releases: []GithubRelease{{TagName: "v2.45.0"}, {TagName: "v3.0.0-beta.1"}},
			want:     "v3.0.0-beta.1",
		},
		{
			name:     "does not mistake v30 or v3x tags for v3",
			releases: []GithubRelease{{TagName: "v30.1.0"}, {TagName: "v3x"}},
			want:     "",
		},
		{
			name:     "empty list",
			releases: nil,
			want:     "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := latestV3Tag(tc.releases); got != tc.want {
				t.Errorf("latestV3Tag() = %q, want %q", got, tc.want)
			}
		})
	}
}
