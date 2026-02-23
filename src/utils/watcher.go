package utils

import (
	"encoding/json"
	"io"
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

type fileState struct {
	modTime time.Time
	size    int64
}

// Watch polls the given files and invokes callbackEach when a file's
// modification time or size changes. This avoids reading entire file
// contents every tick.
func Watch(fileList []string, callbackEach func(fileName string, err error), callbackAfter func()) {
	var cache = map[string]fileState{}

	for {
		finalCallback := false
		for _, v := range fileList {
			stat, err := os.Stat(v)
			if err != nil {
				callbackEach(v, err)
				continue
			}

			prev, exists := cache[v]
			if !exists || stat.ModTime() != prev.modTime || stat.Size() != prev.size {
				cache[v] = fileState{stat.ModTime(), stat.Size()}
				callbackEach(v, nil)
				finalCallback = true
			}
		}

		if callbackAfter != nil && finalCallback {
			callbackAfter()
		}

		time.Sleep(INTERVAL)
	}
}

// WatchRecursive polls all files under root and invokes callbackEach
// when a file's modification time or size changes.
func WatchRecursive(root string, callbackEach func(fileName string, err error), callbackAfter func()) {
	var cache = map[string]fileState{}

	for {
		finalCallback := false

		filepath.WalkDir(root, func(filePath string, info os.DirEntry, _ error) error {
			if info.IsDir() {
				return nil
			}

			fInfo, err := info.Info()
			if err != nil {
				callbackEach(filePath, err)
				return nil
			}

			prev, exists := cache[filePath]
			if !exists || fInfo.ModTime() != prev.modTime || fInfo.Size() != prev.size {
				cache[filePath] = fileState{fInfo.ModTime(), fInfo.Size()}
				callbackEach(filePath, nil)
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
	res, err := HTTPClient.Get("http://localhost:9222/json/list")
	if err != nil {
		return ""
	}
	defer res.Body.Close()

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
