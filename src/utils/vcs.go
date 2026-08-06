package utils

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
)

type GithubRelease struct {
	TagName string `json:"tag_name"`
	Message string `json:"message"`
}

func FetchLatestTag() (string, error) {
	res, err := http.Get("https://api.github.com/repos/spicetify/cli/releases/latest")
	if err != nil {
		return "", err
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}

	var release GithubRelease
	if err = json.Unmarshal(body, &release); err != nil {
		return "", err
	}

	if release.TagName == "" {
		return "", errors.New("GitHub response: " + release.Message)
	}

	return release.TagName[1:], nil
}

// FetchLatestV3Tag returns the newest published v3 tag, or an empty string when
// none exists. v3 ships as prereleases, which /releases/latest never returns.
func FetchLatestV3Tag() (string, error) {
	res, err := http.Get("https://api.github.com/repos/spicetify/cli/releases")
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}

	var releases []GithubRelease
	if err = json.Unmarshal(body, &releases); err != nil {
		return "", err
	}

	return latestV3Tag(releases), nil
}

// latestV3Tag picks the first v3 tag from a GitHub release list, which is
// ordered newest first.
func latestV3Tag(releases []GithubRelease) string {
	for _, release := range releases {
		if strings.HasPrefix(release.TagName, "v3.") || release.TagName == "v3" {
			return release.TagName
		}
	}
	return ""
}
