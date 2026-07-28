package utils

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"
)

// SupportFeed is the published feed's single job: report the newest known
// Spotify desktop build (the one thing the CLI cannot know locally). "What we
// support" is derived from the CLI's own shipped classmaps, not from here, so
// the two cannot drift. Mirrors modules/spotify-support.json, the same file
// the in-client manager reads.
type SupportFeed struct {
	LatestSpotify string `json:"latestSpotify"`
	UpdatedAt     string `json:"updatedAt"`
}

// DefaultSupportFeedURL is the canonical published feed. raw.githubusercontent
// is CORS-open and needs no proxy.
const DefaultSupportFeedURL = "https://raw.githubusercontent.com/spicetify/modules/main/spotify-support.json"

// FeedIsFresh reports whether the feed's updatedAt (YYYY-MM-DD) is present,
// parseable, and no older than maxAge. A stale feed is treated as unavailable
// by the gate: trusting a lagging feed's "latest == supported" could unblock a
// user straight into a newer, unsupported build the feed simply hasn't
// recorded yet. During a genuine quiet period a stale feed only keeps the
// updater disabled a little longer, which costs nothing since there is no
// newer build to advance to.
func FeedIsFresh(updatedAt string, now time.Time, maxAge time.Duration) bool {
	parsed, err := time.Parse("2006-01-02", updatedAt)
	if err != nil {
		return false
	}
	return now.Sub(parsed) <= maxAge
}

// FetchSupportFeed fetches and parses the published support feed. Any network
// or parse failure returns an error so the caller can fail safe (preserve the
// current block state) rather than acting on partial data. It refuses an
// https->http downgrade on redirect, since the feed toggles whether the user's
// updater is disabled and must not be flippable over a plaintext hop.
func FetchSupportFeed(url string) (SupportFeed, error) {
	client := http.Client{
		Timeout: 8 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) > 0 && via[0].URL.Scheme == "https" && req.URL.Scheme != "https" {
				return errors.New("refusing an https->http redirect for the support feed")
			}
			if len(via) >= 10 {
				return errors.New("too many redirects")
			}
			return nil
		},
	}
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
