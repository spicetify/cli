package preprocess

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode"

	"github.com/khanhas/spicetify-cli/src/utils"
)

// Flag enables/disables preprocesses to be applied
type Flag struct {
	// DisableSentry prevents Sentry to send console log/error/warning to Spotify developers.
	DisableSentry bool
	// DisableLogging stops various elements to log user interaction.
	DisableLogging bool
	// RemoveRTL removes all Right-To-Left CSS rules to simplify CSS files.
	RemoveRTL bool
	// ExposeAPIs leaks some Spotify's API, functions, objects to Spicetify global object.
	ExposeAPIs bool
	// DisableUpgrade stops Spotify to display new version upgrade notification
	DisableUpgrade bool
}

type jsMap struct {
	Sources        []string `json:"sources"`
	SourcesContent []string `json:"sourcesContent"`
}

func readRemoteCssMap(tag string, cssTranslationMap *map[string]string) error {
	var cssMapURL string = "https://raw.githubusercontent.com/khanhas/spicetify-cli/" + tag + "/css-map.json"
	cssMapResp, err := http.Get(cssMapURL)
	if err != nil {
		return err
	} else {
		err := json.NewDecoder(cssMapResp.Body).Decode(cssTranslationMap)
		if err != nil {
			utils.PrintWarning("Remote CSS map JSON malformed.")
		}
	}
	return nil
}

func readLocalCssMap(cssTranslationMap *map[string]string) error {
	cssMapLocalPath := path.Join(utils.GetExecutableDir(), "css-map.json")
	cssMapContent, err := os.ReadFile(cssMapLocalPath)
	if err != nil {
		utils.PrintWarning("Cannot read local CSS map.")
		return err
	} else {
		err = json.Unmarshal(cssMapContent, cssTranslationMap)
		if err != nil {
			utils.PrintWarning("Local CSS map JSON malformed.")
			return err
		}
	}
	return nil
}

// Start preprocessing apps assets in extractedAppPath
func Start(version string, extractedAppsPath string, flags Flag) {
	appPath := filepath.Join(extractedAppsPath, "xpui")
	var cssTranslationMap = make(map[string]string)
	// readSourceMapAndGenerateCSSMap(appPath)

	if version != "Dev" {
		tag, err := FetchLatestTagMatchingOrMaster(version)
		if err != nil {
			utils.PrintWarning("Cannot fetch version tag for CSS mappings")
			fmt.Printf("err: %v\n", err)
			tag = version
		}
		utils.PrintInfo("Fetching remote CSS map for newer compatible tag version: " + tag)
		if readRemoteCssMap(tag, &cssTranslationMap) != nil {
			utils.PrintInfo("Cannot fetch remote CSS map. Using local CSS map instead...")
			readLocalCssMap(&cssTranslationMap)
		}
	} else {
		utils.PrintInfo("In development environment, using local CSS map")
		readLocalCssMap(&cssTranslationMap)
	}

	filepath.Walk(appPath, func(path string, info os.FileInfo, err error) error {
		fileName := info.Name()
		extension := filepath.Ext(fileName)

		switch extension {
		case ".js":
			utils.ModifyFile(path, func(content string) string {
				if flags.DisableSentry && fileName == "vendor~xpui.js" {
					content = disableSentry(content)
				}

				if flags.DisableLogging {
					content = disableLogging(content)
				}

				// 		if flags.DisableUpgrade {
				// 			content = disableUpgradeCheck(content, appName)
				// 		}
				if flags.ExposeAPIs {
					switch fileName {
					case "xpui.js":
						content = exposeAPIs_main(content)
					case "vendor~xpui.js":
						content = exposeAPIs_vendor(content)
					}
				}
				for k, v := range cssTranslationMap {
					utils.Replace(&content, k, v)
				}
				content = colorVariableReplaceForJS(content)

				// Webpack name changed from v1.1.72
				utils.Replace(&content, "webpackChunkclient_web", "webpackChunkopen")
				return content
			})
		case ".css":
			utils.ModifyFile(path, func(content string) string {
				for k, v := range cssTranslationMap {
					utils.Replace(&content, k, v)
				}
				if flags.RemoveRTL {
					content = removeRTL(content)
				}
				// Temporary fix for top bar opacity bug
				if fileName == "xpui.css" {
					content = content + `
.main-topBar-topbarContent:not(.main-topBar-topbarContentFadeIn)>* {
	opacity: unset !important;
}
.main-entityHeader-topbarContent:not(.main-entityHeader-topbarContentFadeIn)>* {
	opacity: 0 !important;
}`
				}
				return content
			})

		case ".html":
			utils.ModifyFile(path, func(content string) string {
				var tags string
				tags += `<link rel="stylesheet" class="userCSS" href="colors.css">` + "\n"
				tags += `<link rel="stylesheet" class="userCSS" href="user.css">` + "\n"

				if flags.ExposeAPIs {
					tags += `<script src="helper/spicetifyWrapper.js"></script>` + "\n"
					tags += `<!-- spicetify helpers -->` + "\n"
				}

				utils.Replace(&content, `<body>`, "${0}\n"+tags)

				return content
			})
		}
		return nil
	})

	fakeZLink(filepath.Join(extractedAppsPath, "zlink"))
}

// StartCSS modifies all CSS files in extractedAppsPath to change
// all colors value with CSS variables.
func StartCSS(extractedAppsPath string) {
	appPath := filepath.Join(extractedAppsPath, "xpui")
	filepath.Walk(appPath, func(path string, info os.FileInfo, err error) error {
		if filepath.Ext(info.Name()) == ".css" {
			utils.ModifyFile(path, colorVariableReplace)
		}
		return nil
	})
}

func colorVariableReplace(content string) string {
	utils.Replace(&content, "#181818", "var(--spice-player)")
	utils.Replace(&content, "#212121", "var(--spice-player)")

	utils.Replace(&content, "#282828", "var(--spice-card)")

	utils.Replace(&content, "#121212", "var(--spice-main)")

	utils.Replace(&content, "#000", "var(--spice-sidebar)")
	utils.Replace(&content, "#000000", "var(--spice-sidebar)")

	utils.Replace(&content, "white;", " var(--spice-text);")
	utils.Replace(&content, "#fff", "var(--spice-text)")
	utils.Replace(&content, "#ffffff", "var(--spice-text)")
	utils.Replace(&content, "#f8f8f8", " var(--spice-text)")

	utils.Replace(&content, "#b3b3b3", "var(--spice-subtext)")

	utils.Replace(&content, "#1db954", "var(--spice-button)")
	utils.Replace(&content, "#1877f2", "var(--spice-button)")
	utils.Replace(&content, "#1ed760", "var(--spice-button-active)")
	utils.Replace(&content, "#535353", "var(--spice-button-disabled)")

	utils.Replace(&content, "#333", "var(--spice-tab-active)")
	utils.Replace(&content, "#333333", "var(--spice-tab-active)")

	utils.Replace(&content, "#7f7f7f", "var(--spice-misc)")

	utils.Replace(&content, "#4687d6", "var(--spice-notification)")
	utils.Replace(&content, "#2e77d0", "var(--spice-notification)")

	utils.Replace(&content, "#e22134", "var(--spice-notification-error)")
	utils.Replace(&content, "#cd1a2b", "var(--spice-notification-error)")

	utils.Replace(&content, `rgba\(18,18,18,([\d\.]+)\)`, "rgba(var(--spice-rgb-main),${1})")
	utils.Replace(&content, `rgba\(40,40,40,([\d\.]+)\)`, "rgba(var(--spice-rgb-card),${1})")
	utils.Replace(&content, `rgba\(0,0,0,([\d\.]+)\)`, "rgba(var(--spice-rgb-shadow),${1})")
	utils.Replace(&content, `hsla\(0,0%,100%,\.9\)`, "rgba(var(--spice-rgb-text),.9)")
	utils.Replace(&content, `hsla\(0,0%,100%,([\d\.]+)\)`, "rgba(var(--spice-rgb-selected-row),${1})")

	return content
}

func colorVariableReplaceForJS(content string) string {
	utils.Replace(&content, "#1db954", "var(--spice-button)")
	utils.Replace(&content, "#b3b3b3", "var(--spice-subtext)")
	utils.Replace(&content, `#ffffff`, `var(--spice-text)`)
	utils.Replace(&content, `color:"white"`, `color:"var(--spice-text)"`)
	return content
}

func disableSentry(input string) string {
	utils.Replace(&input, `prototype\.bindClient=function\(\w+\)\{`, "${0}return;")
	return input
}

func disableLogging(input string) string {
	utils.Replace(&input, `sp://logging/v3/\w+`, "")
	return input
}

func removeRTL(input string) string {
	utils.Replace(&input, `}\[dir=ltr\]\s?`, "} ")
	utils.Replace(&input, `html\[dir=ltr\]`, "html")
	utils.Replace(&input, `,\s?\[dir=rtl\].+?(\{.+?\})`, "$1")
	utils.Replace(&input, `[\w\-\.]+\[dir=rtl\].+?\{.+?\}`, "")

	utils.Replace(&input, `\}\[lang=ar\].+?\{.+?\}`, "}")
	utils.Replace(&input, `\}\[dir=rtl\].+?\{.+?\}`, "}")
	utils.Replace(&input, `\}html\[dir=rtl\].+?\{.+?\}`, "}")
	utils.Replace(&input, `\}html\[lang=ar\].+?\{.+?\}`, "}")

	utils.Replace(&input, `\[lang=ar\].+?\{.+?\}`, "")
	utils.Replace(&input, `html\[dir=rtl\].+?\{.+?\}`, "")
	utils.Replace(&input, `html\[lang=ar\].+?\{.+?\}`, "")
	utils.Replace(&input, `\[dir=rtl\].+?\{.+?\}`, "")

	return input
}

func exposeAPIs_main(input string) string {
	// Show Notification
	utils.Replace(
		&input,
		`,(\w+)=(\(\w+=\w+\.dispatch)`,
		`;globalThis.Spicetify.showNotification=(message)=>${1}({message});const ${1}=${2}`)

	// Remove list of exclusive shows
	utils.Replace(
		&input,
		`\["spotify:show.+?\]`,
		`[]`)

	// Remove Star Wars easter eggs since it aggressively
	// listens to keystroke, checking URIs at all time
	utils.Replace(
		&input,
		`\w+\(\)\.createElement\(\w+,\{onChange:this\.handleSaberStateChange\}\),`,
		"")

	// React Hook
	utils.ReplaceOnce(
		&input,
		`\w+=\(\w+,(\w+)\.lazy\)\(?\(\(\)=>\w+\.\w+\((?:\d+)?\)\.then\(\w+\.bind\(\w+,\w+\)\)\)\)?;`,
		`${0}Spicetify.React=${1};`)

	utils.Replace(
		&input,
		`"data-testid":`,
		`"":`)

	reAllAPIPromises := regexp.MustCompile(`return ?{version:\w+,(?:\w+:[\w!,().]+,)+(?:get\w+:(?:async)?\(\)=>[()\w=>{} ]+,)?((?:get\w+:\(\)=>(?:[\w$]+|[(){}]+),?)+)}`)
	allAPIPromises := reAllAPIPromises.FindAllStringSubmatch(input, -1)
	for _, found := range allAPIPromises {
		splitted := strings.Split(found[1], ",")
		if len(splitted) > 15 { // Actual number is about 34
			matchMap := regexp.MustCompile(`get(\w+):\(\)=>([\w$]+|[(){}]+),?`)
			code := "Spicetify.Platform={};"
			for _, apiFunc := range splitted {
				matches := matchMap.FindStringSubmatch(apiFunc)
				code += "Spicetify.Platform[\"" + fmt.Sprint(matches[1]) + "\"]=" + fmt.Sprint(matches[2]) + ";"
			}
			input = strings.Replace(input, found[0], code+found[0], 1)
		}
	}

	// Player
	utils.Replace(
		&input,
		`(Spicetify.Platform\["PlayerAPI"\]=)`,
		`${1}Spicetify.Player.origin=`)

	// Profile Menu hook v1.1.56
	utils.Replace(
		&input,
		`\{listItems:\w+,icons:\w+,onOutsideClick:(\w+)\}=\w+;`,
		`${0};
Spicetify.React.useEffect(() => {
	const container = document.querySelector(".main-userWidget-dropDownMenu")?.parentElement;
	if (!container) {
		console.error("Profile Menu Hook v1.1.56 failed");
		return;
	}
	container._tippy = { props: { onClickOutside: ${1} }};
	Spicetify.Menu._addItems(container);
}, []);`)

	// React Component: Context Menu and Right Click Menu
	utils.Replace(
		&input,
		`=(\w+)=>(\w+\(\)\.createElement\(([\w\.]+),\w*\((\w+,[\w\.]+)?\)\(\{\},\w+,\{action:"open",trigger:"right-click"\}\)\))`,
		`=Spicetify.ReactComponent.RightClickMenu=${1}=>${2};Spicetify.ReactComponent.ContextMenu=${3}`)

	// React Component: Context Menu - Menu
	utils.Replace(
		&input,
		`=\(\{children:\w+,onClose:\w+,getInitialFocusElement:\w+\}\)`,
		`=Spicetify.ReactComponent.Menu${0}`)

	// React Component: Context Menu - Menu Item
	utils.Replace(
		&input,
		`=\w+=>\{let\{children:\w+,icon:\w+`,
		`=Spicetify.ReactComponent.MenuItem${0}`)

	// React Component: Album Context Menu items
	utils.Replace(
		&input,
		`(const \w+)(=\w+\(\)\.memo\(\(\(\{uri:\w+,sharingInfo:\w+,onRemoveCallback:\w+\}\)=>\w+\(\)\.createElement\([\w\.]+,\{value:"album"\})`,
		`${1}=Spicetify.ReactComponent.AlbumMenu${2}`)

	// React Component: Show Context Menu items
	utils.Replace(
		&input,
		`(const \w+)(=\w+\(\)\.memo\(\(\(\{uri:\w+,sharingInfo:\w+,onRemoveCallback:\w+\}\)=>\w+\(\)\.createElement\([\w\.]+,\{value:"show"\})`,
		`${1}=Spicetify.ReactComponent.PodcastShowMenu${2}`)

	// React Component: Artist Context Menu items
	utils.Replace(
		&input,
		`(const \w+)(=\w+\(\)\.memo\(\(\(\{uri:\w+,sharingInfo:\w+,onRemoveCallback:\w+\}\)=>\w+\(\)\.createElement\([\w\.]+,\{value:"artist"\})`,
		`${1}=Spicetify.ReactComponent.ArtistMenu${2}`)

	// React Component: Playlist Context Menu items
	utils.Replace(
		&input,
		`(const \w+)(=\w+\(\)\.memo\(\(\(\{uri:\w+,onRemoveCallback:\w+\}\))`,
		`${1}=Spicetify.ReactComponent.PlaylistMenu${2}`)

	// Locale
	utils.Replace(
		&input,
		`this\._dictionary=\{\},`,
		`${0}Spicetify.Locale=this,`)

	// Prevent breaking popupLyrics
	utils.Replace(
		&input,
		`document.pictureInPictureElement&&\(\w+.current=[!\w]+,document\.exitPictureInPicture\(\)\),\w+\.current=null`,
		``)

	return input
}

func exposeAPIs_vendor(input string) string {
	// URI
	utils.Replace(
		&input,
		`,(\w+)\.prototype\.toAppType`,
		`,(globalThis.Spicetify.URI=${1})${0}`)

	// Mousetrap
	utils.Replace(
		&input,
		`,(\w+\.Mousetrap=(\w+))`,
		`;Spicetify.Mousetrap=${2};${1}`)

	// Context Menu hook
	utils.Replace(
		&input,
		`\w+\("onMount",\[(\w+)\]\)`,
		`${0};
if (${1}.popper?.firstChild?.id === "context-menu") {
    const container = ${1}.popper.firstChild;
	if (!container.children.length) {
		const observer = new MutationObserver(() => {
			Spicetify.ContextMenu._addItems(${1}.popper);
			observer.disconnect();
		});
		observer.observe(container, { childList: true });
    } else if (container.firstChild.classList.contains("main-userWidget-dropDownMenu")) {
        Spicetify.Menu._addItems(${1}.popper);
    } else {
		Spicetify.ContextMenu._addItems(${1}.popper);
	}
};0`)

	utils.ReplaceOnce(
		&input,
		`(\w+=)(\{createPortal:\w+)`,
		`${1}Spicetify.ReactDOM=${2}`)

	return input
}

// Disable WebUI by redirect to zlink app
// so when Spotify forces user to use xpui, it loads zlink instead.
func fakeZLink(dest string) {
	os.MkdirAll(dest, 0700)
	entryFile := filepath.Join(dest, "index.html")
	html := `
<html><script>
	window.location.assign("spotify:app:xpui")
</script></html>
`
	manifestFile := filepath.Join(dest, "manifest.json")
	manifest := `
{
  "BundleIdentifier": "zlink",
  "BundleType": "Application"
}
`
	ioutil.WriteFile(entryFile, []byte(html), 0700)
	ioutil.WriteFile(manifestFile, []byte(manifest), 0700)
}

func disableUpgradeCheck(input, appName string) string {
	return input
}

func readSourceMapAndGenerateCSSMap(appPath string) {
	var cssTranslationMap = make(map[string]string)
	re := regexp.MustCompile(`"(\w+?)":"(_?\w+?-scss)"`)

	filepath.Walk(appPath, func(path string, info os.FileInfo, err error) error {
		extension := filepath.Ext(info.Name())

		switch extension {
		case ".map":
			fileName := strings.Replace(info.Name(), ".js.map", "", 1)
			isNumber, _ := regexp.MatchString(`\d+`, fileName)

			if isNumber {
				fileName = "x"
			} else if fileName == "vendor~xpui" {
				fileName = "vendor"
			} else if fileName == "xpui" {
				fileName = "main"
			} else {
				fileName = strings.Replace(fileName, "xpui-routes-", "", 1)
				fileName = strings.Replace(fileName, "xpui-desktop-", "desktop", 1)
				fileName = strings.Replace(fileName, "xpui-desktop-routes-", "desktop", 1)
			}

			raw, err := ioutil.ReadFile(path)
			if err != nil {
				return err
			}
			var symbolMap jsMap
			if err = json.Unmarshal(raw, &symbolMap); err != nil {
				return err
			}
			for index, content := range symbolMap.SourcesContent {
				if strings.HasPrefix(content, `// extracted by mini-css`) {
					matches := re.FindAllStringSubmatch(string(content), -1)
					if len(matches) == 0 {
						continue
					}

					source := filepath.Base(symbolMap.Sources[index])
					source = strings.Replace(source, ".scss", "", 1)
					// Lower first letter
					temp := []rune(source)
					temp[0] = unicode.ToLower(temp[0])
					source = fileName + "-" + string(temp)

					for _, m := range matches {
						className := source + "-" + m[1]
						savedClassLen := len(cssTranslationMap[m[2]])
						if savedClassLen > 0 && savedClassLen < len(className) {
							continue
						}
						cssTranslationMap[m[2]] = className
					}
				}
			}
		}

		return nil
	})

	cssMapJson, err := json.MarshalIndent(cssTranslationMap, "", "    ")
	if err == nil {
		os.WriteFile("css-map.json", cssMapJson, 777)
	} else {
		println("CSS Map generator failed")
	}
}

type githubRelease = utils.GithubRelease

func splitVersion(version string) ([3]int, error) {
	vstring := version
	if vstring[0:1] == "v" {
		vstring = version[1:]
	}
	vSplit := strings.Split(vstring, ".")
	var vInts [3]int
	if len(vSplit) != 3 {
		return [3]int{}, errors.New("Invalid version string")
	}
	for i := 0; i < 3; i++ {
		conv, err := strconv.Atoi(vSplit[i])
		if err != nil {
			return [3]int{}, nil
		}
		vInts[i] = conv
	}
	return vInts, nil
}

func FetchLatestTagMatchingOrMaster(version string) (string, error) {
	tag, err := utils.FetchLatestTag()
	if err != nil {
		return "", err
	}
	ver, err := splitVersion(tag)
	if err != nil {
		return "", err
	}
	versionS, err := splitVersion(version)
	if err != nil {
		return "", err
	}
	// major version matches latest, use master branch
	if ver[0] == versionS[0] && ver[1] == versionS[1] {
		return "master", nil
	} else {
		return FetchLatestTagMatchingVersion(version)
	}
}

func FetchLatestTagMatchingVersion(version string) (string, error) {
	if version == "Dev" {
		return "Dev", nil
	}
	res, err := http.Get("https://api.github.com/repos/khanhas/spicetify-cli/releases")
	if err != nil {
		return "", err
	}

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return "", err
	}

	var releases []githubRelease
	if err = json.Unmarshal(body, &releases); err != nil {
		return "", err
	}
	curVer := strings.Split(version, ".")
	curVerMin, err2 := strconv.Atoi(curVer[2])
	if err2 != nil {
		return "", err2
	}
	for _, rel := range releases {
		ver := strings.Split(rel.TagName[1:], ".")
		if len(ver) != 3 {
			break
		} else {
			verMin, err := strconv.Atoi(ver[2])
			if err != nil {
				return "", err
			}
			if ver[0] == curVer[0] && ver[1] == curVer[1] && verMin > curVerMin {
				curVerMin = verMin
			}
		}
	}
	return "v" + curVer[0] + "." + curVer[1] + "." + strconv.Itoa(curVerMin), nil
}
