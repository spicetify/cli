package utils

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestFeedIsFresh(t *testing.T) {
	now := time.Date(2026, 7, 28, 12, 0, 0, 0, time.UTC)
	maxAge := 30 * 24 * time.Hour
	cases := []struct {
		name      string
		updatedAt string
		want      bool
	}{
		{"today", "2026-07-28", true},
		{"within window", "2026-07-10", true},
		{"just inside window", "2026-06-29", true},
		{"stale", "2026-05-01", false},
		{"unparseable", "not-a-date", false},
		{"empty", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := FeedIsFresh(tc.updatedAt, now, maxAge); got != tc.want {
				t.Fatalf("FeedIsFresh(%q) = %v, want %v", tc.updatedAt, got, tc.want)
			}
		})
	}
}

func TestFetchSupportFeed(t *testing.T) {
	t.Run("valid feed parses", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Write([]byte(`{"latestSpotify":"1.2.95.100","supportedSpotify":"1.2.94.583","updatedAt":"2026-07-28"}`))
		}))
		defer srv.Close()
		feed, err := FetchSupportFeed(srv.URL)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if feed.LatestSpotify != "1.2.95.100" || feed.SupportedSpotify != "1.2.94.583" {
			t.Fatalf("parsed feed wrong: %+v", feed)
		}
	})

	t.Run("malformed body is an error, not a crash", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Write([]byte(`{not json`))
		}))
		defer srv.Close()
		if _, err := FetchSupportFeed(srv.URL); err == nil {
			t.Fatal("expected an error for malformed JSON")
		}
	})

	t.Run("non-200 is an error", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		}))
		defer srv.Close()
		if _, err := FetchSupportFeed(srv.URL); err == nil {
			t.Fatal("expected an error for HTTP 404")
		}
	})
}
