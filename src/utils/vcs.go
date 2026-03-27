package utils

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
)

var githubToken string

type GithubRelease struct {
	TagName string `json:"tag_name"`
	Message string `json:"message"`
}

func GetURL(targetURL string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}

	if isGithubURL(targetURL) && githubToken != "" {
		req.Header.Set("Authorization", "Bearer "+githubToken)
	}

	return http.DefaultClient.Do(req)
}

func isGithubURL(targetURL string) bool {
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		return false
	}

	hostname := strings.ToLower(parsedURL.Hostname())
	if hostname == "github.com" || hostname == "api.github.com" || hostname == "raw.githubusercontent.com" {
		return true
	}

	return strings.HasSuffix(hostname, ".github.com") || strings.HasSuffix(hostname, ".githubusercontent.com")
}

func FetchLatestTag() (string, error) {
	res, err := GetURL("https://api.github.com/repos/spicetify/cli/releases/latest")
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
