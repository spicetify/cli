package preprocess

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
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

// Start preprocessing apps assets in extractedAppPath
func Start(extractedAppsPath string, flags Flag) {
	appPath := filepath.Join(extractedAppsPath, "xpui")
	var cssTranslationMap = make(map[string]string)
	// readSourceMapAndGenerateCSSMap(appPath)

	var cssMapURL string = "https://raw.githubusercontent.com/khanhas/spicetify-cli/master/css-map.json"
	cssMapResp, err := http.Get(cssMapURL)
	if err != nil {
		utils.PrintInfo("Cannot fetch remote CSS map. Using local CSS map instead...")
		cssMapLocalPath := path.Join(utils.GetExecutableDir(), "css-map.json")
		cssMapContent, err := os.ReadFile(cssMapLocalPath)
		if err != nil {
			utils.PrintWarning("Cannot read local CSS map either.")
		} else {
			err = json.Unmarshal(cssMapContent, &cssTranslationMap)
			if err != nil {
				utils.PrintWarning("Local CSS map JSON malformed.")
			}
		}
	} else {
		err := json.NewDecoder(cssMapResp.Body).Decode(&cssTranslationMap)
		if err != nil {
			utils.PrintWarning("Remote CSS map JSON malformed.")
		}
	}

	filepath.Walk(appPath, func(path string, info os.FileInfo, err error) error {
		fileName := info.Name()
		extension := filepath.Ext(fileName)

		switch extension {
		case ".js":
			utils.ModifyFile(path, func(content string) string {
				if flags.DisableSentry {
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
				if flags.ExposeAPIs {
					tags += `<link rel="stylesheet" class="userCSS" href="user.css">` + "\n"
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
	// utils.Replace(&input, `sentry\.install\(\)[,;]`, "")
	// TODO Broken hooks
	//utils.Replace(&input, `;if\(\w+\.type===\w+\.\w+\.LOG_INTERACTION`, ";return${0}")
	//utils.Replace(&input, `\("https://\w+@sentry.io/\d+"`, `;("https://null@127.0.0.1/0"`)
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
	// Player
	utils.Replace(
		&input,
		`this\._cosmos=(\w+),this\._defaultFeatureVersion=\w+`,
		`(globalThis.Spicetify.Player.origin=this),${0}`)

	utils.Replace(
		&input,
		`,this.player=\w+,`,
		`,(globalThis.Spicetify.Player.origin2=this)${0}`)

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
		`\w+=\(\w+,(\w+)\.lazy\)\(\(function\(\)\{return Promise\.resolve\(\)\.then\(\w+\.bind\(\w+,\w+\)\)\}\)\);`,
		`${0}Spicetify.React=${1};`)

	utils.Replace(
		&input,
		`"data-testid":`,
		`"":`)

	reAllAPIPromises := regexp.MustCompile(`return (\w+=\w+\.sent),\w+\.next=\d,(Promise.all\(\[(\w\.getSession\(\),)([\w\(\)\.,]+?)\]\))([;,])`)
	allAPIPromises := reAllAPIPromises.FindAllStringSubmatch(input, -1)
	for _, found := range allAPIPromises {
		splitted := strings.Split(found[3] + found[4], ",")
		if len(splitted) > 15 { // Actual number is about 24
			re := regexp.MustCompile(`\w+\.(\w+)\(\)`)
			// set t = e.sent, call Promise.all for APIs, then add Spicetify APIs to object
			code := found[1] + ";" + found[2] + ".then(v => {Spicetify.Platform = {};"

			for apiFuncIndex, apiFunc := range splitted {
				name := re.ReplaceAllString(apiFunc, `${1}`)

				if strings.HasPrefix(name, "get") {
					name = strings.Replace(name, "get", "", 1)
				}
				code += "Spicetify.Platform[\"" + name + "\"] = v[" + fmt.Sprint(apiFuncIndex) + "];"
			}
			code += "});"
			// Promise.all(...).then(...); return t = e.sent, e.next = 6, Promise.all(...);
			input = strings.Replace(input, found[0], code + found[0], 1)
		}
	}

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
		`return (\w+\(\)\.createElement\(([\w\.]+),\w+\(\)\(\{\},\w+,\{action:"open",trigger:"right-click"\}\)\))`,
		`Spicetify.ReactComponent.ContextMenu=${2};Spicetify.ReactComponent.RightClickMenu=${1};return Spicetify.ReactComponent.RightClickMenu`)

	// React Component: Context Menu - Menu
	utils.Replace(
		&input,
		`return (\w+\(\)\.createElement\("ul",\w+\(\)\(\{tabIndex:-?\d+,ref:\w+,role:"menu","data-depth":\w+\},\w+\),\w+\))`,//`\w+\(\)\.createElement\([\w\.]+,\{onClose:[\w\.]+,getInitialFocusElement:`,//`\w+\(\)\.createElement\([\w\.]+,\{className:[\w\.]+,onClose:[\w\.]+,onKeyDown:[\w\.]+,onKeyUp:[\w\.]+,getInitialFocusElement:[\w\.]+\},[\w\.]+\)`,
		`return Spicetify.ReactComponent.Menu=${1}`)

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
