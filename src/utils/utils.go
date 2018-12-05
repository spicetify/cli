package utils

import (
	"archive/zip"
	"bufio"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"

	"gopkg.in/cheggaaa/pb.v2"

	backupStatus "../status/backup"
	spotifyStatus "../status/spotify"
	"github.com/go-ini/ini"
	"github.com/logrusorgru/aurora"
)

func GetSpotifyStatus(spotifyPath string) spotifyStatus.Enum {
	appsFolder := filepath.Join(spotifyPath, "Apps")
	fileList, err := ioutil.ReadDir(appsFolder)
	if err != nil {
		log.Fatal(err)
	}

	spaCount := 0
	dirCount := 0
	for _, file := range fileList {
		if file.IsDir() {
			dirCount++
			continue
		}

		if strings.HasSuffix(file.Name(), ".spa") {
			spaCount++
		}
	}

	totalFiles := len(fileList)
	if spaCount == totalFiles {
		return spotifyStatus.STOCK
	}

	if dirCount == totalFiles {
		return spotifyStatus.APPLIED
	}

	return spotifyStatus.INVALID
}

func GetBackupStatus(spotifyPath, backupPath, backupVersion string) backupStatus.Enum {
	fileList, err := ioutil.ReadDir(backupPath)
	if err != nil {
		log.Fatal(err)
	}

	if len(fileList) == 0 {
		return backupStatus.EMPTY
	}

	spotifyVersion := GetSpotifyVersion(spotifyPath)

	if backupVersion != spotifyVersion {
		return backupStatus.OUTDATED
	}

	spaCount := 0
	for _, file := range fileList {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".spa") {
			spaCount++
		}
	}

	if spaCount > 0 {
		return backupStatus.BACKUPED
	}

	os.RemoveAll(backupPath)
	return backupStatus.EMPTY
}

// ReadAnswer prints out a yes/no form with string from `info`
// and returns boolean value based on user input (y/Y or n/N) or
// return `defaultAnswer` if input is omitted.
// If input is neither of them, print form again.
func ReadAnswer(info string, defaultAnswer bool) bool {
	reader := bufio.NewReader(os.Stdin)
	fmt.Print(info)
	text, _ := reader.ReadString('\n')
	text = strings.Replace(text, "\r", "", 1)
	text = strings.Replace(text, "\n", "", 1)
	if len(text) == 0 {
		return defaultAnswer
	} else if text == "y" || text == "Y" {
		return true
	} else if text == "n" || text == "N" {
		return false
	}
	return ReadAnswer(info, defaultAnswer)
}

func CheckExistAndCreate(dir string) {
	_, err := os.Stat(dir)
	if err != nil {
		os.Mkdir(dir, 0644)
	}
}

func Unzip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		rc, err := f.Open()
		if err != nil {
			return err
		}
		defer rc.Close()

		fpath := filepath.Join(dest, f.Name)
		if f.FileInfo().IsDir() {
			os.MkdirAll(fpath, f.Mode())
		} else {
			var fdir string
			if lastIndex := strings.LastIndex(fpath, string(os.PathSeparator)); lastIndex > -1 {
				fdir = fpath[:lastIndex]
			}

			err = os.MkdirAll(fdir, f.Mode())
			if err != nil {
				log.Fatal(err)
				return err
			}
			f, err := os.OpenFile(
				fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
			if err != nil {
				return err
			}
			defer f.Close()

			_, err = io.Copy(f, rc)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func Replace(input string, regexpTerm string, replaceTerm string) string {
	re := regexp.MustCompile(regexpTerm)
	return re.ReplaceAllString(input, replaceTerm)
}

func GetBool(section *ini.Section, keyName string, defVal bool) bool {
	return section.Key(keyName).MustInt(0) == 1
}

func ModifyFile(path string, repl func(string) string) {
	raw, err := ioutil.ReadFile(path)
	if err != nil {
		log.Print(err)
		return
	}

	content := repl(string(raw))

	ioutil.WriteFile(path, []byte(content), 0644)
}

func GetPrefsCfg(spotifyPath string) (*ini.File, string, error) {
	var path string
	if runtime.GOOS == "windows" {
		path = filepath.Join(spotifyPath, "prefs")
	} else if runtime.GOOS == "linux" {
		path = filepath.Join(os.Getenv("HOME"), ".config", "spotify", "prefs")
	} else if runtime.GOOS == "darwin" {
		path = filepath.Join(os.Getenv("HOME"), "Library", "Application Support", "Spotify", "prefs")
	} else {
		return nil, "", errors.New("Unsupported OS")
	}

	cfg, err := ini.Load(path)
	if err != nil {
		cfg = ini.Empty()
	}
	return cfg, path, nil
}

func GetSpotifyVersion(spotifyPath string) string {
	pref, _, err := GetPrefsCfg(spotifyPath)
	if err != nil {
		log.Fatal(err)
	}

	rootSection, err := pref.GetSection("")
	if err != nil {
		log.Fatal(err)
	}

	version := rootSection.Key("app.last-launched-version")
	return version.MustString("")
}

func GetDevToolStatus(spotifyPath string) bool {
	pref, _, err := GetPrefsCfg(spotifyPath)
	if err != nil {
		log.Fatal(err)
	}

	rootSection, err := pref.GetSection("")
	if err != nil {
		log.Fatal(err)
	}

	devTool, err := rootSection.GetKey("app.enable-developer-mode")
	if err != nil {
		log.Fatal(err)
	}
	return devTool.MustBool(false)
}

func SetDevTool(spotifyPath string, enable bool) {
	pref, prefFilePath, err := GetPrefsCfg(spotifyPath)
	if err != nil {
		log.Fatal(err)
	}

	rootSection, err := pref.GetSection("")
	if err != nil {
		log.Fatal(err)
	}

	devTool := rootSection.Key("app.enable-developer-mode")

	if enable {
		devTool.SetValue("true")
	} else {
		devTool.SetValue("false")
	}

	ini.PrettyFormat = false
	pref.SaveTo(prefFilePath)
}

func NewTracker(total int) *pb.ProgressBar {
	return pb.ProgressBarTemplate(`{{counters . }} {{string . "appName" | green}}`).Start(total)
}

func PrintColor(color string, bold bool, text string) {
	var value aurora.Value

	switch color {
	case "red":
		value = aurora.Red(text)
	case "green":
		value = aurora.Green(text)
	default:
		return
	}

	if bold {
		value = value.Bold()
	}

	log.Println(value)
}

func PrintBold(text string) {
	log.Println(aurora.Bold(text))
}

func RunCopy(from, to string, recursive bool, filters []string) error {
	var cmd *exec.Cmd
	var paraList = []string{from, to}

	if runtime.GOOS == "windows" {
		roboCopy := filepath.Join(os.Getenv("windir"), "System32\\robocopy.exe")
		if recursive {
			paraList = append(paraList, "/E")
		}

		if filters != nil && len(filters) > 0 {
			paraList = append(paraList, filters...)
		}

		cmd = exec.Command(roboCopy, paraList...)
	} else if runtime.GOOS == "linux" || runtime.GOOS == "darwin" {
		var optionList = []string{"--recursive"}

		if filters != nil && len(filters) > 0 {
			optionList = append(optionList, "--include", "*/")

			for _, v := range filters {
				optionList = append(optionList, "--include", v)
			}

			optionList = append(optionList, "--exclude", "*")
		}

		optionList = append(optionList, from+"/", to)

		cmd = exec.Command("rsync", optionList...)
	} else {
		return errors.New("Unsupported OS")
	}

	cmd.Run()

	return nil
}

func GetExecutableDir() string {
	if runtime.GOOS == "windows" || runtime.GOOS == "darwin" || runtime.GOOS == "linux" {
		exe, err := os.Executable()
		if err != nil {
			log.Fatal(err)
		}

		return filepath.Dir(exe)
	}

	log.Fatal("Unsupported OS")
	return ""
}

func GetJsHelperDir() string {
	return filepath.Join(GetExecutableDir(), "jsHelper")
}
