package utils

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestGetDebuggerPath(t *testing.T) {
	cases := []struct {
		name   string
		status int
		body   string
		want   string
	}{
		{"spotify target", 200, `[{"url":"https://example.com","webSocketDebuggerUrl":"ws://x/1"},{"url":"https://xpui.app.spotify.com/","webSocketDebuggerUrl":"ws://x/2"}]`, "ws://x/2"},
		{"no spotify target", 200, `[{"url":"https://example.com","webSocketDebuggerUrl":"ws://x/1"}]`, ""},
		{"invalid json", 200, `not json`, ""},
		{"error status", 500, `[{"url":"spotify","webSocketDebuggerUrl":"ws://x/3"}]`, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(c.status)
				w.Write([]byte(c.body))
			}))
			defer srv.Close()
			if got := getDebuggerPath(srv.URL); got != c.want {
				t.Fatalf("got %q, want %q", got, c.want)
			}
		})
	}
}

func TestGetDebuggerPathUnreachable(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	url := srv.URL
	srv.Close()
	if got := getDebuggerPath(url); got != "" {
		t.Fatalf("got %q, want empty", got)
	}
}

func TestGetDebuggerPathTimesOut(t *testing.T) {
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { <-release }))
	defer srv.Close()
	defer close(release)

	old := debuggerClient.Timeout
	debuggerClient.Timeout = 100 * time.Millisecond
	defer func() { debuggerClient.Timeout = old }()

	if got := getDebuggerPath(srv.URL); got != "" {
		t.Fatalf("got %q, want empty", got)
	}
}

// WatchRecursive must not panic when the watched root does not exist, and
// should start reporting files once it appears.
func TestWatchRecursiveMissingRoot(t *testing.T) {
	root := filepath.Join(t.TempDir(), "missing")
	panicked := make(chan any, 1)
	changed := make(chan string, 1)
	go func() {
		defer func() {
			if p := recover(); p != nil {
				panicked <- p
			}
		}()
		WatchRecursive(root, func(name string, err error) {
			if err == nil {
				select {
				case changed <- name:
				default:
				}
			}
		}, nil)
	}()

	select {
	case p := <-panicked:
		t.Fatalf("WatchRecursive panicked: %v", p)
	case <-time.After(450 * time.Millisecond):
	}

	file := filepath.Join(root, "asset.txt")
	if err := os.MkdirAll(root, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(file, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}

	select {
	case got := <-changed:
		if got != file {
			t.Fatalf("got %q, want %q", got, file)
		}
	case p := <-panicked:
		t.Fatalf("WatchRecursive panicked: %v", p)
	case <-time.After(3 * time.Second):
		t.Fatal("file creation was not detected")
	}
}
