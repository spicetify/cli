package utils

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
)

var githubAPIClient = &http.Client{Timeout: 30 * time.Second}

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

// FetchReleaseAssetURL returns the API URL of the asset called name in release v{tag}.
// It returns an error with the HTTP status and GitHub's message when the API request fails.
func FetchReleaseAssetURL(tag, name string) (string, error) {
	res, err := githubAPIClient.Get("https://api.github.com/repos/spicetify/cli/releases/tags/v" + tag)
	if err != nil {
		return "", err
	}

	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		var apiErr struct {
			Message string `json:"message"`
		}
		msg := "GitHub API returned " + res.Status
		if json.NewDecoder(res.Body).Decode(&apiErr) == nil && apiErr.Message != "" {
			msg += ": " + apiErr.Message
		}
		return "", errors.New(msg)
	}

	var release struct {
		Assets []struct {
			Name string `json:"name"`
			URL  string `json:"url"`
		} `json:"assets"`
	}

	if err = json.NewDecoder(res.Body).Decode(&release); err != nil {
		return "", err
	}

	for _, asset := range release.Assets {
		if asset.Name == name {
			return asset.URL, nil
		}
	}

	return "", errors.New("asset " + name + " not found in release v" + tag)
}
