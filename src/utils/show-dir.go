package utils

import (
	"os/exec"
	"runtime"
)

// ShowDirectory shows directory in user's default file manager application
func ShowDirectory(dir string) error {

	var err error
	err = nil

	if runtime.GOOS == "windows" {
		_, err = exec.Command("start", dir).Output()
	} else if runtime.GOOS == "linux" {
		_, err = exec.Command("xdg-open", dir).Output()
	} else if runtime.GOOS == "darwin" {
		_, err = exec.Command("open", dir).Output()
	}

	return err
}
