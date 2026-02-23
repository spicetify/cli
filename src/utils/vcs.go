package utils

import (
	"encoding/json"
	"errors"
	"io"
)

type GithubRelease struct {
	TagName string `json:"tag_name"`
	Message string `json:"message"`
}

func FetchLatestTag() (string, error) {
	res, err := HTTPClient.Get("https://api.github.com/repos/spicetify/cli/releases/latest")
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

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
