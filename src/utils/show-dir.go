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
		_, err = exec.Command("explorer", dir).Output()
		if(err != nil && err.Error() == "exit status 1") {
			err = nil
		}
	} else if runtime.GOOS == "linux" {
		_, err = exec.Command("xdg-open", dir).Output()
	} else if runtime.GOOS == "darwin" {
		_, err = exec.Command("open", dir).Output()
	}

	return err
}
