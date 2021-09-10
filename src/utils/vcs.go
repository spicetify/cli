package utils

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
)

type GithubRelease struct {
	TagName string `json:"tag_name"`
}

func FetchLatestTag() (string, error) {
	res, err := http.Get("https://api.github.com/repos/khanhas/spicetify-cli/releases/latest")
	if err != nil {
		return "", err
	}

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return "", err
	}

	var release GithubRelease
	if err = json.Unmarshal(body, &release); err != nil {
		return "", err
	}

	return release.TagName[1:], nil
}