package utils

import (
	"encoding/json"
	"io"
	"net/http"
	"time"
)

// SupportFeed is the published source of truth for the update gate: the
// newest known Spotify desktop build and the newest build with a verified
// Spicetify classmap. It mirrors modules/spotify-support.json, the same file
// the in-client manager reads, so the CLI and the client agree.
type SupportFeed struct {
	LatestSpotify    string `json:"latestSpotify"`
	SupportedSpotify string `json:"supportedSpotify"`
	UpdatedAt        string `json:"updatedAt"`
}

// DefaultSupportFeedURL is the canonical published feed. raw.githubusercontent
// is CORS-open and needs no proxy.
const DefaultSupportFeedURL = "https://raw.githubusercontent.com/spicetify/modules/main/spotify-support.json"

// FetchSupportFeed fetches and parses the published support feed. Any network
// or parse failure returns an error so the caller can fail safe (preserve the
// current block state) rather than acting on partial data.
func FetchSupportFeed(url string) (SupportFeed, error) {
	client := http.Client{Timeout: 8 * time.Second}
	res, err := client.Get(url)
	if err != nil {
		return SupportFeed{}, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return SupportFeed{}, &FeedError{Status: res.StatusCode}
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return SupportFeed{}, err
	}
	var feed SupportFeed
	if err := json.Unmarshal(body, &feed); err != nil {
		return SupportFeed{}, err
	}
	return feed, nil
}

// FeedError reports a non-200 response from the support feed.
type FeedError struct{ Status int }

func (e *FeedError) Error() string {
	return "support feed returned HTTP " + http.StatusText(e.Status)
}
