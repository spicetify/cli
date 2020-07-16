package cmd

import (
	"encoding/json"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/khanhas/spicetify-cli/src/utils"
)

type githubRelease struct {
	URL             string `json:"url"`
	AssetsURL       string `json:"assets_url"`
	UploadURL       string `json:"upload_url"`
	HTMLURL         string `json:"html_url"`
	ID              int    `json:"id"`
	NodeID          string `json:"node_id"`
	TagName         string `json:"tag_name"`
	TargetCommitish string `json:"target_commitish"`
	Name            string `json:"name"`
	Draft           bool   `json:"draft"`
	Author          struct {
		Login             string `json:"login"`
		ID                int    `json:"id"`
		NodeID            string `json:"node_id"`
		AvatarURL         string `json:"avatar_url"`
		GravatarID        string `json:"gravatar_id"`
		URL               string `json:"url"`
		HTMLURL           string `json:"html_url"`
		FollowersURL      string `json:"followers_url"`
		FollowingURL      string `json:"following_url"`
		GistsURL          string `json:"gists_url"`
		StarredURL        string `json:"starred_url"`
		SubscriptionsURL  string `json:"subscriptions_url"`
		OrganizationsURL  string `json:"organizations_url"`
		ReposURL          string `json:"repos_url"`
		EventsURL         string `json:"events_url"`
		ReceivedEventsURL string `json:"received_events_url"`
		Type              string `json:"type"`
		SiteAdmin         bool   `json:"site_admin"`
	} `json:"author"`
	Prerelease  bool      `json:"prerelease"`
	CreatedAt   time.Time `json:"created_at"`
	PublishedAt time.Time `json:"published_at"`
	Assets      []struct {
		URL      string      `json:"url"`
		ID       int         `json:"id"`
		NodeID   string      `json:"node_id"`
		Name     string      `json:"name"`
		Label    interface{} `json:"label"`
		Uploader struct {
			Login             string `json:"login"`
			ID                int    `json:"id"`
			NodeID            string `json:"node_id"`
			AvatarURL         string `json:"avatar_url"`
			GravatarID        string `json:"gravatar_id"`
			URL               string `json:"url"`
			HTMLURL           string `json:"html_url"`
			FollowersURL      string `json:"followers_url"`
			FollowingURL      string `json:"following_url"`
			GistsURL          string `json:"gists_url"`
			StarredURL        string `json:"starred_url"`
			SubscriptionsURL  string `json:"subscriptions_url"`
			OrganizationsURL  string `json:"organizations_url"`
			ReposURL          string `json:"repos_url"`
			EventsURL         string `json:"events_url"`
			ReceivedEventsURL string `json:"received_events_url"`
			Type              string `json:"type"`
			SiteAdmin         bool   `json:"site_admin"`
		} `json:"uploader"`
		ContentType        string    `json:"content_type"`
		State              string    `json:"state"`
		Size               int       `json:"size"`
		DownloadCount      int       `json:"download_count"`
		CreatedAt          time.Time `json:"created_at"`
		UpdatedAt          time.Time `json:"updated_at"`
		BrowserDownloadURL string    `json:"browser_download_url"`
	} `json:"assets"`
	TarballURL string `json:"tarball_url"`
	ZipballURL string `json:"zipball_url"`
	Body       string `json:"body"`
}

func Upgrade(currentVersion string) {
	utils.PrintBold("Fetch latest release info:")
	res, err := http.Get("https://api.github.com/repos/khanhas/spicetify-cli/releases/latest")
	if err != nil {
		utils.Fatal(err)
	}

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		utils.Fatal(err)
	}

	var release githubRelease
	if err = json.Unmarshal(body, &release); err != nil {
		utils.Fatal(err)
	}
	utils.PrintGreen("OK")
	tagName := release.TagName[1:]
	utils.PrintInfo("Current version: " + currentVersion)
	utils.PrintInfo("Latest release: " + tagName)
	if currentVersion == tagName {
		utils.PrintSuccess("Already up-to-date.")
		// return
	}

	var assetURL string = "https://github.com/khanhas/spicetify-cli/releases/download/v" + tagName + "/spicetify-" + tagName
	var location string
	switch runtime.GOOS {
	case "windows":
		assetURL += "-windows-x64.zip"
		location = os.Getenv("TEMP") + "spicetify-" + tagName + ".zip"
	case "linux":
		assetURL += "-linux-amd64.tar.gz"
		location = "/tmp/spicetify-" + tagName + ".tar.gz"
	case "darwin":
		assetURL += "-darwin-amd64.tar.gz"
		location = os.Getenv("TMPDIR") + "spicetify-" + tagName + ".tar.gz"
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
		permissionError(err)
	}

	utils.CheckExistAndDelete(exeOld)
	utils.PrintGreen("OK")
	utils.PrintSuccess("spicetify is up-to-date.")
}

func permissionError(err error) {
	utils.PrintInfo("If fatal error is \"Permission denied\", please check read/write permission of spicetify executable directory.")
	utils.PrintInfo("However, if you used a package manager to install spicetify, please upgrade by using the same package manager.")
	utils.Fatal(err)
}
