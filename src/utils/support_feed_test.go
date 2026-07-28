package utils

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

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
