package preprocess

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
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
	Sources []string `json:"sources"`
	SourcesContent []string `json:"sourcesContent"`
}

// Start preprocessing apps assets in extractedAppPath
func Start(extractedAppsPath string, flags Flag, callback func(appName string)) {
	appPath := filepath.Join(extractedAppsPath, "xpui")
	var cssTranslationMap = make(map[string]string)
	re := regexp.MustCompile(`"(\w+?)":"(_?\w+?-scss)"`)

	filepath.Walk(appPath, func(path string, info os.FileInfo, err error) error {
		extension := filepath.Ext(info.Name())

		switch extension {
		case ".map":
			fileName := strings.Replace(info.Name(), ".js.map", "", 1)
			isNumber, _ := regexp.MatchString(`\d+`, fileName)

			if isNumber {
				fileName = "x-" + fileName
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
				utils.Replace(&content, `</head>`, `<link rel="stylesheet" class="userCSS" href="user.css"></head>`)

				var tags string
				if flags.ExposeAPIs {
					tags += `<script src="spicetifyWrapper.js"></script>`
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
func StartCSS(extractedAppsPath string, callback func(appName string)) {
	appList, err := ioutil.ReadDir(extractedAppsPath)

	if err != nil {
		log.Fatal(err)
	}

	var wg sync.WaitGroup

	for _, app := range appList {
		wg.Add(1)
		appName := app.Name()
		appPath := filepath.Join(extractedAppsPath, appName)

		go func() {
			defer wg.Done()

			filepath.Walk(appPath, func(path string, info os.FileInfo, err error) error {
				if filepath.Ext(info.Name()) == ".css" {
					utils.ModifyFile(path, colorVariableReplace)
				}
				return nil
			})

			callback(appName)
		}()
	}

	wg.Wait()
}

func colorVariableReplace(content string) string {
	utils.Replace(&content, "#999999", "var(--modspotify_main_bg)")
	utils.Replace(&content, "#606060", "var(--modspotify_main_bg)")
	utils.Replace(&content, "#181818", "var(--modspotify_main_bg)")
	utils.Replace(&content, "#212121", "var(--modspotify_main_bg)")
	utils.Replace(&content, "gray;", " var(--modspotify_main_bg);")

	utils.Replace(&content, "#282828", "var(--modspotify_sidebar_and_player_bg)")
	utils.Replace(&content, "#121212", "var(--modspotify_sidebar_and_player_bg)")
	utils.Replace(&content, "#000000", "var(--modspotify_sidebar_and_player_bg)")
	utils.Replace(&content, "#000011", "var(--modspotify_sidebar_and_player_bg)")
	utils.Replace(&content, "#0a1a2d", "var(--modspotify_sidebar_and_player_bg)")
	utils.Replace(&content, "#000", "var(--modspotify_sidebar_and_player_bg)")
	utils.Replace(&content, "black;", " var(--modspotify_sidebar_and_player_bg);")

	utils.Replace(&content, "#ffffff", "var(--modspotify_main_fg)")
	utils.Replace(&content, "#fff", "var(--modspotify_main_fg)")
	utils.Replace(&content, "white;", " var(--modspotify_main_fg);")
	utils.Replace(&content, "#f8f8f8", " var(--modspotify_main_fg)")

	utils.Replace(&content, "#adafb2", "var(--modspotify_secondary_fg)")
	utils.Replace(&content, "#c8c8c8", "var(--modspotify_secondary_fg)")
	utils.Replace(&content, "#a0a0a0", "var(--modspotify_secondary_fg)")
	utils.Replace(&content, "#bec0bb", "var(--modspotify_secondary_fg)")
	utils.Replace(&content, "#bababa", "var(--modspotify_secondary_fg)")
	utils.Replace(&content, "#b3b3b3", "var(--modspotify_secondary_fg)")
	utils.Replace(&content, "#c0c0c0", "var(--modspotify_secondary_fg)")

	utils.Replace(&content, "#1ed660", "var(--modspotify_sidebar_indicator_and_hover_button_bg)")
	utils.Replace(&content, "#1ed760", "var(--modspotify_sidebar_indicator_and_hover_button_bg)")

	utils.Replace(&content, "#1db954", "var(--modspotify_indicator_fg_and_button_bg)")
	utils.Replace(&content, "#1df369", "var(--modspotify_indicator_fg_and_button_bg)")
	utils.Replace(&content, "#1df269", "var(--modspotify_indicator_fg_and_button_bg)")
	utils.Replace(&content, "#1cd85e", "var(--modspotify_indicator_fg_and_button_bg)")
	utils.Replace(&content, "#1bd85e", "var(--modspotify_indicator_fg_and_button_bg)")
	utils.Replace(&content, "#1da64d", "var(--modspotify_indicator_fg_and_button_bg)")
	utils.Replace(&content, "#1877f2", "var(--modspotify_indicator_fg_and_button_bg)")

	utils.Replace(&content, "#18ac4d", "var(--modspotify_selected_button)")
	utils.Replace(&content, "#18ab4d", "var(--modspotify_selected_button)")

	utils.Replace(&content, "#179443", "var(--modspotify_pressing_button_bg)")
	utils.Replace(&content, "#14833b", "var(--modspotify_pressing_button_bg)")

	utils.Replace(&content, "#ededed", "var(--modspotify_pressing_button_fg)")
	utils.Replace(&content, "#cccccc", "var(--modspotify_pressing_button_fg)")
	utils.Replace(&content, "#8f8f8f;", " var(--modspotify_pressing_button_fg);")
	utils.Replace(&content, "#ccc", "var(--modspotify_pressing_button_fg)")
	utils.Replace(&content, "#ddd", "var(--modspotify_pressing_button_fg)")
	utils.Replace(&content, "lightgray;", " var(--modspotify_pressing_button_fg);")
	utils.Replace(&content, "#7f7f7f", "var(--modspotify_pressing_button_fg)")

	utils.Replace(&content, "#333333", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")
	utils.Replace(&content, "#3f3f3f", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")
	utils.Replace(&content, "#535353", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")
	utils.Replace(&content, "#333", "var(--modspotify_scrollbar_fg_and_selected_row_bg)")

	utils.Replace(&content, "#404040", "var(--modspotify_slider_bg)")
	utils.Replace(&content, "#444", "var(--modspotify_slider_bg)")

	utils.Replace(&content, "#f8f8f7", "var(--modspotify_pressing_fg)")
	utils.Replace(&content, "#fcfcfc", "var(--modspotify_pressing_fg)")
	utils.Replace(&content, "#d9d9d9", "var(--modspotify_pressing_fg)")
	utils.Replace(&content, "#cdcdcd", "var(--modspotify_pressing_fg)")
	utils.Replace(&content, "#e6e6e6", "var(--modspotify_pressing_fg)")
	utils.Replace(&content, "#e5e5e5", "var(--modspotify_pressing_fg)")

	utils.Replace(&content, "#4687d6", "var(--modspotify_miscellaneous_bg)")
	utils.Replace(&content, "#cd1a2b", "var(--modspotify_miscellaneous_bg)")

	utils.Replace(&content, "#2e77d0", "var(--modspotify_miscellaneous_hover_bg)")
	utils.Replace(&content, "#4591ee", "var(--modspotify_miscellaneous_hover_bg)")
	utils.Replace(&content, "#386cab", "var(--modspotify_miscellaneous_hover_bg)")
	utils.Replace(&content, "#e22134", "var(--modspotify_miscellaneous_hover_bg)")

	utils.Replace(&content, `rgba\(18,\s?18,\s?18,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(18,\s?19,\s?20,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(80,\s?55,\s?80,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(40,\s?40,\s?40,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(40,\s?40,\s?40,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(24,\s?24,\s?24,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(18,\s?19,\s?20,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(70,\s?135,\s?214,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_miscellaneous_bg),${1})")
	utils.Replace(&content, `rgba\(51,\s?153,\s?255,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_miscellaneous_hover_bg),${1})")
	utils.Replace(&content, `rgba\(30,\s?50,\s?100,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_miscellaneous_hover_bg),${1})")
	utils.Replace(&content, `rgba\(24,\s?24,\s?24,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(25,\s?20,\s?20,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_sidebar_and_player_bg),${1})")
	utils.Replace(&content, `rgba\(160,\s?160,\s?160,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_pressing_button_fg),${1})")
	utils.Replace(&content, `rgba\(255,\s?255,\s?255,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_pressing_button_fg),${1})")
	utils.Replace(&content, `rgba\(0,\s?0,\s?0,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_cover_overlay_and_shadow),${1})")
	utils.Replace(&content, `rgba\(179,\s?179,\s?179,\s?([\d\.]+)\)`, "rgba(var(--modspotify_rgb_secondary_fg),${1})")
	utils.Replace(&content, `hsla\(0,0%,100%,([\d\.]+)\)`, "rgba(var(--modspotify_rgb_main_fg),${1})")

	return content
}

func colorVariableReplaceForJS(content string) string {
	utils.Replace(&content, "#1db954", "var(--modspotify_indicator_fg_and_button_bg)")
	utils.Replace(&content, "#b3b3b3", "var(--modspotify_secondary_fg)")
	return content
}

func disableSentry(input string) string {
	// utils.Replace(&input, `sentry\.install\(\)[,;]`, "")
	utils.Replace(&input, `;if\(\w+\.type===\w+\.\w+\.LOG_INTERACTION`, ";return${0}")
	utils.Replace(&input, `\("https://\w+@sentry.io/\d+"`, `;("https://null@127.0.0.1/0"`)
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

	utils.Replace(
		&input,
		`;class \w+ extends (\w+)\(\).Component`,
		`;Spicetify.React=${1}()${0}`)

	utils.Replace(
		&input,
		`"data-testid":`,
		`"":`)

	reAllAPIPromises := regexp.MustCompile(`await Promise.all\(\[([\w\(\)\.,]+?)\]\)([;,])`)
	allAPIPromises := reAllAPIPromises.FindAllStringSubmatch(input, -1)
	for _, found := range(allAPIPromises) {
		splitted := strings.Split(found[1], ",");
		if len(splitted) > 15 { // Actual number is about 24
			re := regexp.MustCompile(`\w+\.(\w+)\(\)`)
			code := "Spicetify.Platform = {"

			for _, apiFunc := range(splitted) {
				name := re.ReplaceAllString(apiFunc, `${1}`)

				if strings.HasPrefix(name, "get") {
					name = strings.Replace(name, "get", "", 1);
				}
					
				code += name + ": await " + apiFunc + ","
			}

			code += "};"
			if found[2] == "," { // Future proof
				code = "undefined;" + code + "var "
			}

			input = strings.Replace(input, found[0], found[0] + code, 1)
		}
	}

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
if (G.popper?.firstChild?.id === "context-menu") {
    const container = G.popper.firstChild;
	if (!container.children.length) {
		const observer = new MutationObserver(() => {
			Spicetify.ContextMenu._addItems(G.popper);
			observer.disconnect();
		});
		observer.observe(container, { childList: true });
    } else if (container.firstChild.classList.contains("main-userWidget-dropDownMenu")) {
        Spicetify.Menu._addItems(G.popper);
    } else {
		Spicetify.ContextMenu._addItems(G.popper);
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
