package utils

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/net/websocket"
)

var (
	// INTERVAL .
	INTERVAL = 200 * time.Millisecond
)

// Watch .
func Watch(fileList []string, callbackEach func(fileName string, err error), callbackAfter func()) {
	var cache = map[string][]byte{}

	for {
		finalCallback := false
		for _, v := range fileList {
			curr, err := os.ReadFile(v)
			if err != nil {
				callbackEach(v, err)
				continue
			}

			if !bytes.Equal(cache[v], curr) {
				callbackEach(v, nil)
				cache[v] = curr
				finalCallback = true
			}
		}

		if callbackAfter != nil && finalCallback {
			callbackAfter()
		}

		time.Sleep(INTERVAL)
	}
}

// WatchRecursive .
func WatchRecursive(root string, callbackEach func(fileName string, err error), callbackAfter func()) {
	var cache = map[string][]byte{}

	for {
		finalCallback := false

		filepath.WalkDir(root, func(filePath string, info os.DirEntry, _ error) error {
			if info.IsDir() {
				return nil
			}

			curr, err := os.ReadFile(filePath)
			if err != nil {
				callbackEach(filePath, err)
				return nil
			}

			if !bytes.Equal(cache[filePath], curr) {
				callbackEach(filePath, nil)
				cache[filePath] = curr
				finalCallback = true
			}

			return nil
		})

		if callbackAfter != nil && finalCallback {
			callbackAfter()
		}

		time.Sleep(INTERVAL)
	}
}

type debugger struct {
	Description          string
	DevtoolsFrontendUrl  string
	Id                   string
	Title                string
	Type                 string
	Url                  string
	WebSocketDebuggerUrl string
}

// GetDebuggerPath fetches opening debugger list from localhost and returns
// the Spotify one.
func GetDebuggerPath() string {
	res, err := http.Get("http://localhost:9222/json/list")
	if err != nil {
		return ""
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return ""
	}

	var list []debugger
	if err = json.Unmarshal(body, &list); err != nil {
		return ""
	}

	for _, debugger := range list {
		if strings.Contains(debugger.Url, "spotify") {
			return debugger.WebSocketDebuggerUrl
		}
	}

	return ""
}

// SendReload sends reload command to debugger Websocket server
func SendReload(debuggerURL *string) error {
	if len(*debuggerURL) == 0 {
		*debuggerURL = GetDebuggerPath()
	}

	socket, err := websocket.Dial(*debuggerURL, "", "http://localhost/")
	if err != nil {
		return err
	}
	defer socket.Close()

	if _, err := socket.Write([]byte(`{"id":0,"method":"Runtime.evaluate","params":{"expression":"window.location.reload()"}}`)); err != nil {
		return err
	}

	return nil
}

// cssHotSwapExpression re-fetches the theme's "colors.css" and "user.css"
// stylesheet links (tagged with class "userCSS", see src/preprocess) by
// bumping a cache-busting query param, instead of reloading the whole page.
// This updates colors/CSS in place without resetting app state (e.g. playback).
const cssHotSwapExpression = `(() => {
	var bust = Date.now();
	var links = document.querySelectorAll("link.userCSS");
	links.forEach(function (link) {
		var url = new URL(link.href, window.location.href);
		url.searchParams.set("spicetify_reload", bust);
		link.href = url.toString();
	});
	return links.length;
})()`

// SendCSSReload sends a command to the debugger Websocket server that
// hot-swaps the theme's stylesheet links without reloading the page,
// so Spotify's playback and window state are left untouched.
func SendCSSReload(debuggerURL *string) error {
	if len(*debuggerURL) == 0 {
		*debuggerURL = GetDebuggerPath()
	}

	if len(*debuggerURL) == 0 {
		return errors.New("no debugger connection to Spotify found")
	}

	socket, err := websocket.Dial(*debuggerURL, "", "http://localhost/")
	if err != nil {
		return err
	}
	defer socket.Close()

	payload, err := json.Marshal(map[string]any{
		"id":     0,
		"method": "Runtime.evaluate",
		"params": map[string]string{"expression": cssHotSwapExpression},
	})
	if err != nil {
		return err
	}

	if _, err := socket.Write(payload); err != nil {
		return err
	}

	return nil
}
