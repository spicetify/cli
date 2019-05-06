package utils

import (
	"os"
	"bytes"
	"io/ioutil"
	"path/filepath"
	"time"
)

var (
	// INTERVAL .
	INTERVAL = 200 * time.Millisecond
)

// Watch .
func Watch(fileList []string, callback func(fileName string, err error)) {
	var cache = map[string][]byte{}

	for {
		for _, v := range fileList {
			curr, err := ioutil.ReadFile(v)
			if err != nil {
				callback(v, err)
				continue
			}

			if !bytes.Equal(cache[v], curr) {
				callback(v, nil)
				cache[v] = curr
			}
		}

		time.Sleep(INTERVAL)
	}
}

// WatchRecursive .
func WatchRecursive(root string, callback func(fileName string, err error)) {
	var cache = map[string][]byte{}

	for {
		filepath.Walk(root, func(filePath string, info os.FileInfo, err error) error {
			if info.IsDir() {
				return nil
			}

			curr, err := ioutil.ReadFile(filePath)
			if err != nil {
				callback(filePath, err)
				return nil
			}

			if !bytes.Equal(cache[filePath], curr) {
				callback(filePath, nil)
				cache[filePath] = curr
			}

			return nil
		})

		time.Sleep(INTERVAL)
	}
}
