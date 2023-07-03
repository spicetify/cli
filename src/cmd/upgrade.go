package cmd

import (
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	backupstatus "github.com/spicetify/spicetify-cli/src/status/backup"
	"github.com/spicetify/spicetify-cli/src/utils"
)

func Upgrade(currentVersion string) bool {
	utils.PrintBold("Fetch latest release info:")
	tagName, err := utils.FetchLatestTag()
	if err != nil {
		utils.PrintError("Cannot fetch latest release info")
		utils.PrintError(err.Error())
		return false
	}
	utils.PrintGreen("OK")

	utils.PrintInfo("Current version: " + currentVersion)
	utils.PrintInfo("Latest release: " + tagName)
	if currentVersion == tagName {
		utils.PrintSuccess("Already up-to-date.")
		return false
	}

	var assetURL string = "https://github.com/spicetify/spicetify-cli/releases/download/v" + tagName + "/spicetify-" + tagName
	var location string
	switch runtime.GOOS {
	case "windows":
		if runtime.GOARCH == "386" {
			assetURL += "-windows-x32.zip"
		} else {
			assetURL += "-windows-x64.zip"
		}
		location = os.TempDir() + "/spicetify-" + tagName + ".zip"
	case "linux":
		if runtime.GOARCH == "arm64" {
			assetURL += "-linux-arm64.tar.gz"
		} else {
			assetURL += "-linux-amd64.tar.gz"
		}
		location = os.TempDir() + "/spicetify-" + tagName + ".tar.gz"
	case "darwin":
		if runtime.GOARCH == "arm64" {
			assetURL += "-darwin-arm64.tar.gz"
		} else {
			assetURL += "-darwin-amd64.tar.gz"
		}
		location = os.TempDir() + "/spicetify-" + tagName + ".tar.gz"
	}

	utils.PrintBold("Downloading:")

	out, err := os.Create(location)
	if err != nil {
		utils.Fatal(err)
	}
	defer out.Close()

	resp2, err := http.Get(assetURL)
	if err != nil {
		utils.Fatal(err)
	}

	_, err = io.Copy(out, resp2.Body)
	if err != nil {
		utils.Fatal(err)
	}
	utils.PrintGreen("OK")

	exe, err := os.Executable()
	if err != nil {
		utils.Fatal(err)
	}
	if exe, err = filepath.EvalSymlinks(exe); err != nil {
		utils.Fatal(err)
	}

	exeOld := exe + ".old"
	utils.CheckExistAndDelete(exeOld)

	if err = os.Rename(exe, exeOld); err != nil {
		permissionError(err)
	}

	utils.PrintBold("Extracting:")
	switch runtime.GOOS {
	case "windows":
		err = utils.Unzip(location, utils.GetExecutableDir())

	case "linux", "darwin":
		err = exec.Command("tar", "-xzf", location, "-C", utils.GetExecutableDir()).Run()
	}
	if err != nil {
		os.Rename(exeOld, exe)
		permissionError(err)
	}

	utils.CheckExistAndDelete(exeOld)
	utils.PrintGreen("OK")
	utils.PrintSuccess("spicetify is up-to-date.")
	backupVersion := backupSection.Key("version").MustString("")
	backStat := backupstatus.Get(prefsPath, backupFolder, backupVersion)
	cmd := []string{"spicetify", "backup", "apply"}
	if !backStat.IsOutdated() {
		cmd = append(cmd[:1], append([]string{"restore"}, cmd[1:]...)...)
	}
	utils.PrintInfo(`Please run "` + strings.Join(cmd, " ") + `" to receive new features and bug fixes`)
	return true
}

func permissionError(err error) {
	utils.PrintInfo("If fatal error is \"Permission denied\", please check read/write permission of spicetify executable directory.")
	utils.PrintInfo("However, if you used a package manager to install spicetify, please upgrade by using the same package manager.")
	utils.Fatal(err)
}
