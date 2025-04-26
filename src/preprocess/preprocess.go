package preprocess

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"github.com/pterm/pterm"
	"github.com/spicetify/cli/src/utils"
)

// Flag enables/disables preprocesses to be applied
type Flag struct {
	// DisableSentry prevents Sentry to send console log/error/warning to Spotify developers.
	DisableSentry bool
	// DisableLogging stops various elements to log user interaction.
	DisableLogging bool
	// RemoveRTL removes all Right-To-Left CSS rules to simplify CSS files.
	RemoveRTL bool
	// ExposeAPIs leaks Spotify's API, functions, objects to Spicetify global object.
	ExposeAPIs bool
	SpotifyVer string
}

type Patch struct {
	Name        string
	Regex       string
	Replacement func(submatches ...string) string
	Once        bool
}

type logPatch func(string)

func applyPatches(input string, patches []Patch, report ...logPatch) string {
	for _, patch := range patches {
		if len(report) > 0 && report[0] != nil {
			report[0](fmt.Sprintf("%s patch", patch.Name))
		}
		if patch.Once {
			utils.ReplaceOnce(&input, patch.Regex, patch.Replacement)
		} else {
			utils.Replace(&input, patch.Regex, patch.Replacement)
		}
	}
	return input
}

func readRemoteCssMap(tag string, cssTranslationMap *map[string]string) error {
	var cssMapURL string = "https://raw.githubusercontent.com/spicetify/cli/" + tag + "/css-map.json"
	cssMapResp, err := http.Get(cssMapURL)
	if err != nil {
		return err
	} else {
		err := json.NewDecoder(cssMapResp.Body).Decode(cssTranslationMap)
		if err != nil {
			utils.PrintWarning("Remote CSS map JSON malformed.")
			return err
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

func Start(version string, spotifyBasePath string, extractedAppsPath string, flags Flag) {
	appPath := filepath.Join(extractedAppsPath, "xpui")
	var cssTranslationMap = make(map[string]string)
	// readSourceMapAndGenerateCSSMap(appPath)

	if version != "Dev" {
		tag, err := FetchLatestTagMatchingOrMain(version)
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

	verParts := strings.Split(flags.SpotifyVer, ".")
	spotifyMajor, spotifyMinor, spotifyPatch := 0, 0, 0
	if len(verParts) > 0 {
		spotifyMajor, _ = strconv.Atoi(verParts[0])
	}
	if len(verParts) > 1 {
		spotifyMinor, _ = strconv.Atoi(verParts[1])
	}
	if len(verParts) > 2 {
		spotifyPatch, _ = strconv.Atoi(verParts[2])
	}

	frameworkResourcesPath := ""
	switch runtime.GOOS {
	case "darwin":
		frameworkResourcesPath = filepath.Join(spotifyBasePath, "..", "Frameworks", "Chromium Embedded Framework.framework", "Resources")
	case "windows", "linux":
		frameworkResourcesPath = spotifyBasePath
	default:
		utils.PrintError("Unsupported OS for V8 snapshot finding: " + runtime.GOOS)
	}

	if frameworkResourcesPath != "" {
		files, err := os.ReadDir(frameworkResourcesPath)
		if err != nil {
			utils.PrintWarning(fmt.Sprintf("Could not read directory %s for V8 snapshots: %v", frameworkResourcesPath, err))
		} else {
			for _, file := range files {
				if !file.IsDir() && strings.HasPrefix(file.Name(), "v8_context_snapshot") && strings.HasSuffix(file.Name(), ".bin") {
					binFilePath := filepath.Join(frameworkResourcesPath, file.Name())
					utils.PrintInfo("Processing V8 snapshot file: " + binFilePath)

					startMarker := []byte("var __webpack_modules__={")
					endMarker := []byte("xpui-modules.js.map")

					embeddedString, _, _, err := utils.ReadStringFromUTF16Binary(binFilePath, startMarker, endMarker)
					if err != nil {
						utils.PrintWarning(fmt.Sprintf("Could not process %s: %v", binFilePath, err))
						utils.PrintInfo("You can ignore this warning if you're on a Spotify version that didn't yet add xpui modules to the V8 snapshot")
						continue
					}

					err = utils.CreateFile(filepath.Join(appPath, "xpui-modules.js"), embeddedString)
					if err != nil {
						utils.PrintWarning(fmt.Sprintf("Could not create xpui-modules.js: %v", err))
						break
					} else {
						utils.PrintSuccess("Extracted V8 snapshot blob (remaining xpui modules) to xpui-modules.js")
						break
					}
				}
			}
		}
	}

	var filesToPatch []string
	filepath.Walk(appPath, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		ext := filepath.Ext(info.Name())
		if ext == ".js" || ext == ".css" || ext == ".html" {
			filesToPatch = append(filesToPatch, path)
		}
		return nil
	})

	totalFiles := len(filesToPatch)

	style := pterm.NewStyle(pterm.FgWhite, pterm.BgBlack)
	bar, _ := pterm.DefaultProgressbar.WithTotal(totalFiles).WithTitle("Patching files...").WithTitleStyle(style).WithShowCount(true).Start()
	printPatch := func(msg string) {
		bar.UpdateTitle(msg)
	}
	for _, path := range filesToPatch {
		info, err := os.Stat(path)
		if err != nil {
			continue
		}
		fileName := info.Name()
		extension := filepath.Ext(fileName)

		switch extension {
		case ".js":
			utils.ModifyFile(path, func(content string) string {
				if flags.DisableSentry && (fileName == "xpui.js" || fileName == "xpui-snapshot.js") {
					printPatch("Disable Sentry")
					content = disableSentry(content)
				}

				if flags.DisableLogging {
					content = disableLogging(content)
				}

				if flags.ExposeAPIs {
					switch fileName {
					case "xpui-modules.js", "xpui-snapshot.js":
						content = exposeAPIs_main(content, printPatch)
						content = exposeAPIs_vendor(content, printPatch)
					case "xpui.js":
						content = exposeAPIs_main(content, printPatch)
						if spotifyMajor >= 1 && spotifyMinor >= 2 && spotifyPatch >= 57 {
							content = exposeAPIs_vendor(content, printPatch)
						}
					case "vendor~xpui.js":
						content = exposeAPIs_vendor(content, printPatch)
					}
				}
				printPatch("CSS (JS): Patching our mappings into file")
				for k, v := range cssTranslationMap {
					utils.Replace(&content, k, func(submatches ...string) string {
						return v
					})
				}
				content = colorVariableReplaceForJS(content)

				return content
			})
		case ".css":
			utils.ModifyFile(path, func(content string) string {
				printPatch("CSS: Patching our mappings into file")
				for k, v := range cssTranslationMap {
					utils.Replace(&content, k, func(submatches ...string) string {
						return v
					})
				}
				if flags.RemoveRTL {
					printPatch("Remove RTL")
					content = removeRTL(content)
				}
				if fileName == "xpui.css" {
					printPatch("Extra CSS Patch")
					content = content + `
					.main-gridContainer-fixedWidth{grid-template-columns: repeat(auto-fill, var(--column-width));width: calc((var(--column-count) - 1) * var(--grid-gap)) + var(--column-count) * var(--column-width));}.main-cardImage-imageWrapper{background-color: var(--card-color, #333);border-radius: 6px;-webkit-box-shadow: 0 8px 24px rgba(0, 0, 0, .5);box-shadow: 0 8px 24px rgba(0, 0, 0, .5);padding-bottom: 100%;position: relative;width:100%;}.main-cardImage-image,.main-card-imagePlaceholder{height: 100%;left: 0;position: absolute;top: 0;width: 100%};.main-content-view{height:100%;}
					`
				}
				return content
			})

		case ".html":
			utils.ModifyFile(path, func(content string) string {
				printPatch("Inject wrapper/CSS")
				var tags string
				tags += "<link rel='stylesheet' class='userCSS' href='colors.css'>\n"
				tags += "<link rel='stylesheet' class='userCSS' href='user.css'>\n"

				if flags.ExposeAPIs {
					tags += "<script src='helper/spicetifyWrapper.js'></script>\n"
					tags += "<!-- spicetify helpers -->\n"
				}

				utils.Replace(&content, `<body(\sclass="[^"]*")?>`, func(submatches ...string) string {
					return fmt.Sprintf("%s\n%s", submatches[0], tags)
				})

				return content
			})
		}

		bar.Increment()
	}
}

// StartCSS modifies all CSS files in extractedAppsPath to change
// all colors value with CSS variables.
func StartCSS(extractedAppsPath string) {
	appPath := filepath.Join(extractedAppsPath, "xpui")
	filepath.Walk(appPath, func(path string, info os.FileInfo, err error) error {
		// temp so text won't be black ._.
		if info.Name() == "pip-mini-player.css" {
			return nil
		}

		if filepath.Ext(info.Name()) == ".css" {
			utils.ModifyFile(path, func(content string) string {
				return colorVariableReplace(content)
			})
		}
		return nil
	})
}

func colorVariableReplace(content string) string {
	colorPatches := []Patch{
		{
			Name:  "CSS: --spice-player",
			Regex: "#(181818|212121)",
			Replacement: func(submatches ...string) string {
				return "var(--spice-player)"
			},
		},
		{
			Name:  "CSS: --spice-card",
			Regex: "#282828",
			Replacement: func(submatches ...string) string {
				return "var(--spice-card)"
			},
		},
		{
			Name:  "CSS: --spice-main-elevated",
			Regex: "#(242424|1f1f1f)",
			Replacement: func(submatches ...string) string {
				return "var(--spice-main-elevated)"
			},
		},
		{
			Name:  "CSS: --spice-main",
			Regex: "#121212",
			Replacement: func(submatches ...string) string {
				return "var(--spice-main)"
			},
		},
		{
			Name:  "CSS: --spice-card-elevated",
			Regex: "#(242424|1f1f1f)",
			Replacement: func(submatches ...string) string {
				return "var(--spice-card-elevated)"
			},
		},
		{
			Name:  "CSS: --spice-highlight",
			Regex: "#1a1a1a",
			Replacement: func(submatches ...string) string {
				return "var(--spice-highlight)"
			},
		},
		{
			Name:  "CSS: --spice-highlight-elevated",
			Regex: "#2a2a2a",
			Replacement: func(submatches ...string) string {
				return "var(--spice-highlight-elevated)"
			},
		},
		{
			Name:  "CSS: --spice-sidebar",
			Regex: "#(000|000000)",
			Replacement: func(submatches ...string) string {
				return "var(--spice-sidebar)"
			},
		},
		{
			Name:  "CSS: --spice-text",
			Regex: "white;|#fff|#ffffff|#f8f8f8",
			Replacement: func(submatches ...string) string {
				return "var(--spice-text)"
			},
		},
		{
			Name:  "CSS: --spice-subtext",
			Regex: "#(b3b3b3|a7a7a7)",
			Replacement: func(submatches ...string) string {
				return "var(--spice-subtext)"
			},
		},
		{
			Name:  "CSS: --spice-button",
			Regex: "#(1db954|1877f2)",
			Replacement: func(submatches ...string) string {
				return "var(--spice-button)"
			},
		},
		{
			Name:  "CSS: --spice-button-active",
			Regex: "#(1ed760|1fdf64|169c46)",
			Replacement: func(submatches ...string) string {
				return "var(--spice-button-active)"
			},
		},
		{
			Name:  "CSS: --spice-button-disabled",
			Regex: "#535353",
			Replacement: func(submatches ...string) string {
				return "var(--spice-button-disabled)"
			},
		},
		{
			Name:  "CSS: --spice-tab-active",
			Regex: "#(333|333333)",
			Replacement: func(submatches ...string) string {
				return "var(--spice-tab-active)"
			},
		},
		{
			Name:  "CSS: --spice-misc",
			Regex: "#7f7f7f",
			Replacement: func(submatches ...string) string {
				return "var(--spice-misc)"
			},
		},
		{
			Name:  "CSS: --spice-notification",
			Regex: "#(4687d6|2e77d0)",
			Replacement: func(submatches ...string) string {
				return "var(--spice-notification)"
			},
		},
		{
			Name:  "CSS: --spice-notification-error",
			Regex: "#(e22134|cd1a2b)",
			Replacement: func(submatches ...string) string {
				return "var(--spice-notification-error)"
			},
		},
		{
			Name:  "CSS (rgba): --spice-main",
			Regex: `rgba\(18,18,18,([\d\.]+)\)`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("rgba(var(--spice-main),%s)", submatches[1])
			},
		},
		{
			Name:  "CSS (rgba): --spice-card",
			Regex: `rgba\(40,40,40,([\d\.]+)\)`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("rgba(var(--spice-card),%s)", submatches[1])
			},
		},
		{
			Name:  "CSS (rgba): --spice-rgb-shadow",
			Regex: `rgba\(0,0,0,([\d\.]+)\)`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("rgba(var(--spice-rgb-shadow),%s)", submatches[1])
			},
		},
		{
			Name:  "CSS (hsla): --spice-rgb-text",
			Regex: `hsla\(0,0%,100%,\.9\)`,
			Replacement: func(submatches ...string) string {
				return "rgba(var(--spice-rgb-text),.9)"
			},
		},
		{
			Name:  "CSS (hsla): --spice-rgb-selected-row",
			Regex: `hsla\(0,0%,100%,([\d\.]+)\)`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("rgba(var(--spice-rgb-selected-row),%s)", submatches[1])
			},
		},
	}

	return applyPatches(content, colorPatches)
}

func colorVariableReplaceForJS(content string) string {
	colorVariablePatches := []Patch{
		{
			Name:  "CSS (JS): --spice-button",
			Regex: `"#1db954"`,
			Replacement: func(submatches ...string) string {
				return ` getComputedStyle(document.body).getPropertyValue("--spice-button").trim()`
			},
		},
		{
			Name:  "CSS (JS): --spice-subtext",
			Regex: `"#b3b3b3"`,
			Replacement: func(submatches ...string) string {
				return ` getComputedStyle(document.body).getPropertyValue("--spice-subtext").trim()`
			},
		},
		{
			Name:  "CSS (JS): --spice-text",
			Regex: `"#ffffff"`,
			Replacement: func(submatches ...string) string {
				return ` getComputedStyle(document.body).getPropertyValue("--spice-text").trim()`
			},
		},
		{
			Name:  "CSS (JS): --spice-text white",
			Regex: `color:"white"`,
			Replacement: func(submatches ...string) string {
				return `color:"var(--spice-text)"`
			},
		},
	}

	return applyPatches(content, colorVariablePatches)
}

func disableSentry(input string) string {
	//utils.Replace(&input, `\(([^,]+),([^,]+),\{sampleRate:([^,]+),tracesSampleRate:([^,]+)(,.*?)?\}`, func(submatches ...string) string {
	//	return fmt.Sprintf(",%s", submatches[0])
	//})
	// Spotify enables sentry only for versions that are newer than 30 days old.
	utils.Replace(&input, "/864e5<30", func(submatches ...string) string {
		return "<0"
	})
	return input
}

func disableLogging(input string) string {
	loggingPatches := []Patch{
		{
			Name:  "Remove sp://logging/v3/*",
			Regex: `sp://logging/v3/\w+`,
			Replacement: func(submatches ...string) string {
				return ""
			},
		},
		{
			Name:  "Remove /v3/events endpoints",
			Regex: `[^"\/]+\/[^"\/]+\/(public\/)?v3\/events`,
			Replacement: func(submatches ...string) string {
				return ""
			},
		},
		{
			Name:  "Disable registerEventListeners",
			Regex: `key:"registerEventListeners",value:function\(\)\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable logInteraction",
			Regex: `key:"logInteraction",value:function\([\w,]+\)\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn {interactionId:null,pageInstanceId:null};", submatches[0])
			},
		},
		{
			Name:  "Disable logNonAuthInteraction",
			Regex: `key:"logNonAuthInteraction",value:function\([\w,]+\)\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn {interactionId:null,pageInstanceId:null};", submatches[0])
			},
		},
		{
			Name:  "Disable logImpression",
			Regex: `key:"logImpression",value:function\([\w,]+\)\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable logNonAuthImpression",
			Regex: `key:"logNonAuthImpression",value:function\([\w,]+\)\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable logNavigation",
			Regex: `key:"logNavigation",value:function\([\w,]+\)\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable handleBackgroundStates",
			Regex: `key:"handleBackgroundStates",value:function\(\)\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable createLoggingParams",
			Regex: `key:"createLoggingParams",value:function\([\w,]+\)\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable initSendingEvents",
			Regex: `key:"initSendingEvents",value:function\(\)\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable flush",
			Regex: `key:"flush",value:function\(\)\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable send",
			Regex: `(\{key:"send",value:function\([\w,]+\))\{[\d\w\s,{}()[\]\.,!\?=>&|;:_""]+?\}(\},\{key:"hasContext")`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%s{return;}%s", submatches[1], submatches[2])
			},
		},
		{
			Name:  "Disable lastFlush",
			Regex: `key:"lastFlush",value:function\(\)\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn Promise.resolve({fired:true});", submatches[0])
			},
		},
		{
			Name:  "Disable addItemInEventsStorage",
			Regex: `key:"addItemInEventsStorage",value:function\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable createLoggingParams (new)",
			Regex: `key:"createLoggingParams",value:function\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn {interactionIds:null,pageInstanceIds:null};", submatches[0])
			},
		},
		{
			Name:  "Disable addEventsToESSData",
			Regex: `key:"addEventsToESSData",value:function\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable registerEventListeners (new)",
			Regex: `registerEventListeners\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable logInteraction (new)",
			Regex: `logInteraction\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn {interactionId:null,pageInstanceId:null};", submatches[0])
			},
		},
		{
			Name:  "Disable logImpression (new)",
			Regex: `logImpression\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable logNavigation (new)",
			Regex: `logNavigation\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable handleBackgroundStates (new)",
			Regex: `handleBackgroundStates\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable initSendingEvents (new)",
			Regex: `initSendingEvents\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable sendEvents",
			Regex: `sendEvents\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable storeEvent",
			Regex: `storeEvent\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable lastFlush (new)",
			Regex: `lastFlush\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn Promise.resolve({fired:true});", submatches[0])
			},
		},
		{
			Name:  "Disable addItemInEventsStorage (new)",
			Regex: `addItemInEventsStorage\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
		{
			Name:  "Disable createLoggingParams (new)",
			Regex: `createLoggingParams\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn {interactionIds:null,pageInstanceIds:null};", submatches[0])
			},
		},
		{
			Name:  "Disable addEventsToESSData (new)",
			Regex: `addEventsToESSData\([^)]*\)\s*\{`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sreturn;", submatches[0])
			},
		},
	}
	return applyPatches(input, loggingPatches)
}

func removeRTL(input string) string {
	rtlPatches := []Patch{
		{
			Name:  "Remove }[dir=ltr]",
			Regex: `}\[dir=ltr\]\s?`,
			Replacement: func(submatches ...string) string {
				return "} "
			},
		},
		{
			Name:  "Remove html[dir=ltr]",
			Regex: `html\[dir=ltr\]`,
			Replacement: func(submatches ...string) string {
				return "html"
			},
		},
		{
			Name:  "Remove ', [dir=rtl]' selectors",
			Regex: `,\s?\[dir=rtl\].+?(\{.+?\})`,
			Replacement: func(submatches ...string) string {
				return submatches[1]
			},
		},
		{
			Name:  "Remove [something][dir=rtl] blocks",
			Regex: `[\w\-\.]+\[dir=rtl\].+?\{.+?\}`,
			Replacement: func(submatches ...string) string {
				return ""
			},
		},
		{
			Name:  "Remove }[lang=ar] blocks",
			Regex: `\}\[lang=ar\].+?\{.+?\}`,
			Replacement: func(submatches ...string) string {
				return "}"
			},
		},
		{
			Name:  "Remove }[dir=rtl] blocks",
			Regex: `\}\[dir=rtl\].+?\{.+?\}`,
			Replacement: func(submatches ...string) string {
				return "}"
			},
		},
		{
			Name:  "Remove }html[dir=rtl] blocks",
			Regex: `\}html\[dir=rtl\].+?\{.+?\}`,
			Replacement: func(submatches ...string) string {
				return "}"
			},
		},
		{
			Name:  "Remove }html[lang=ar] blocks",
			Regex: `\}html\[lang=ar\].+?\{.+?\}`,
			Replacement: func(submatches ...string) string {
				return "}"
			},
		},
		{
			Name:  "Remove [lang=ar] blocks",
			Regex: `\[lang=ar\].+?\{.+?\}`,
			Replacement: func(submatches ...string) string {
				return ""
			},
		},
		{
			Name:  "Remove html[dir=rtl] blocks",
			Regex: `html\[dir=rtl\].+?\{.+?\}`,
			Replacement: func(submatches ...string) string {
				return ""
			},
		},
		{
			Name:  "Remove html[lang=ar] blocks",
			Regex: `html\[lang=ar\].+?\{.+?\}`,
			Replacement: func(submatches ...string) string {
				return ""
			},
		},
		{
			Name:  "Remove [dir=rtl] blocks",
			Regex: `\[dir=rtl\].+?\{.+?\}`,
			Replacement: func(submatches ...string) string {
				return ""
			},
		},
	}

	return applyPatches(input, rtlPatches)
}

func exposeAPIs_main(input string, report logPatch) string {
	inputContextMenu := utils.FindFirstMatch(input, `.*value:"contextmenu"`)
	if len(inputContextMenu) > 0 {
		croppedInput := inputContextMenu[0]
		react := utils.FindLastMatch(croppedInput, `([a-zA-Z_\$][\w\$]*)\.useRef`)[1]
		candicates := utils.FindLastMatch(croppedInput, `\(\{[^}]*menu:([a-zA-Z_\$][\w\$]*),[^}]*trigger:([a-zA-Z_\$][\w\$]*),[^}]*triggerRef:([a-zA-Z_\$][\w\$]*)`)
		oldCandicates := utils.FindLastMatch(croppedInput, `([a-zA-Z_\$][\w\$]*)=[\w_$]+\.menu[^}]*,([a-zA-Z_\$][\w\$]*)=[\w_$]+\.trigger[^}]*,([a-zA-Z_\$][\w\$]*)=[\w_$]+\.triggerRef`)
		var menu, trigger, target string
		if len(oldCandicates) != 0 {
			menu = oldCandicates[1]
			trigger = oldCandicates[2]
			target = oldCandicates[3]
		} else if len(candicates) != 0 {
			menu = candicates[1]
			trigger = candicates[2]
			target = candicates[3]
		} else {
			menu = "e.menu"
			trigger = "e.trigger"
			target = "e.triggerRef"
		}

		utils.Replace(&input, `\(0,([\w_$]+)\.jsx\)\([\w_$]+\.[\w_$]+,\{value:"contextmenu"[^\}]+\}\)\}\)`, func(submatches ...string) string {
			return fmt.Sprintf("(0,%s.jsx)((Spicetify.ContextMenuV2._context||(Spicetify.ContextMenuV2._context=%s.createContext(null))).Provider,{value:{props:%s?.props,trigger:%s,target:%s},children:%s})", submatches[1], react, menu, trigger, target, submatches[0])
		})
	}

	xpuiPatches := []Patch{
		{
			Name:  "showNotification patch",
			Regex: `(?:\w+ |,)([\w$]+)=(\([\w$]+=[\w$]+\.dispatch)`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf(`;globalThis.Spicetify.showNotification=(message,isError=false,msTimeout)=>%s({message,feedbackType:isError?"ERROR":"NOTICE",msTimeout});const %s=%s`, submatches[1], submatches[1], submatches[2])
			},
		},
		{
			Name:  "Remove list of exclusive shows",
			Regex: `\["spotify:show.+?\]`,
			Replacement: func(submatches ...string) string {
				return "[]"
			},
		},
		{
			Name:  "Remove Star Wars easter eggs",
			Regex: `\w+\(\)\.createElement\(\w+,\{onChange:this\.handleSaberStateChange\}\),`,
			Replacement: func(submatches ...string) string {
				return ""
			},
		},
		{
			Name:  "Remove data-testid",
			Regex: `"data-testid":`,
			Replacement: func(submatches ...string) string {
				return `"":`
			},
		},
		{
			Name:  "Expose PlatformAPI",
			Regex: `((?:setTitlebarHeight|registerFactory)[\w(){}<>:.,&$!=;""?!#% ]+)(\{version:[a-zA-Z_\$][\w\$]*,)`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sSpicetify._platform=%s", submatches[1], submatches[2])
			},
		},
		{
			Name:  "Redux store",
			Regex: `(,[\w$]+=)(([$\w,.:=;(){}]+\(\{session:[\w$]+,features:[\w$]+,seoExperiment:[\w$]+\}))`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sSpicetify.Platform.ReduxStore=%s", submatches[1], submatches[2])
			},
		},
		{
			Name:  "React Component: Platform Provider",
			Regex: `(,[$\w]+=)((function\([\w$]{1}\)\{var [\w$]+=[\w$]+\.platform,[\w$]+=[\w$]+\.children,)|(\(\{platform:[\w$]+,children:[\w$]+\}\)=>\{))`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sSpicetify.ReactComponent.PlatformProvider=%s", submatches[1], submatches[2])
			},
		},
		{
			Name:  "Prevent breaking popupLyrics",
			Regex: `document.pictureInPictureElement&&\(\w+.current=[!\w]+,document\.exitPictureInPicture\(\)\),\w+\.current=null`,
			Replacement: func(submatches ...string) string {
				return ""
			},
		},
		{
			Name:  "GraphQL definitions (<=1.2.30)",
			Regex: `((?:\w+ ?)?[\w$]+=)(\{kind:"Document",definitions:\[\{(?:\w+:[\w"]+,)+name:\{(?:\w+:[\w"]+,?)+value:("\w+"))`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sSpicetify.GraphQL.Definitions[%s]=%s", submatches[1], submatches[3], submatches[2])
			},
		},
		{
			Name:  "GraphQL definitons (>=1.2.31)",
			Regex: `(=new [\w_\$][\w_\$\d]*\.[\w_\$][\w_\$\d]*\("(\w+)","(query|mutation)","[\w\d]{64}",null\))`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf(`=Spicetify.GraphQL.Definitions["%s"]%s`, submatches[2], submatches[1])
			},
		},
		{
			Name:  "Spotify Custom Snackbar Interfaces (<=1.2.37)",
			Regex: `\b\w\s*\(\)\s*[^;,]*enqueueCustomSnackbar:\s*(\w)\s*[^;]*;`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sSpicetify.Snackbar.enqueueCustomSnackbar=%s;", submatches[0], submatches[1])
			},
		},
		{
			Name:  "Spotify Custom Snackbar Interfaces (>=1.2.38)",
			Regex: `(=)[^=]*\(\)\.enqueueCustomSnackbar;`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("=Spicetify.Snackbar.enqueueCustomSnackbar%s;", submatches[0])
			},
		},
		{
			Name:  "Spotify Image Snackbar Interface",
			Regex: `\(\({[^}]*,\s*imageSrc`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("Spicetify.Snackbar.enqueueImageSnackbar=%s", submatches[0])
			},
		},
		{
			Name:  "React Component: Navigation for navLinks",
			Regex: `(;const [\w\d]+=)((?:\(0,[\w\d]+\.memo\))[\(\d,\w\.\){:}=]+\=[\d\w]+\.[\d\w]+\.getLocaleForURLPath\(\))`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%sSpicetify.ReactComponent.Navigation=%s", submatches[1], submatches[2])
			},
			Once: true,
		},
		{
			Name:  "Context Menu V2",
			Regex: `("Menu".+?children:)([\w$][\w$\d]*)`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%s[Spicetify.ContextMenuV2.renderItems(),%s].flat()", submatches[1], submatches[2])
			},
		},
	}

	return applyPatches(input, xpuiPatches, report)
}

func exposeAPIs_vendor(input string, report logPatch) string {
	// URI
	utils.Replace(
		&input,
		`,(\w+)\.prototype\.toAppType`,
		func(submatches ...string) string {
			return fmt.Sprintf(`,(globalThis.Spicetify.URI=%s)%s`, submatches[1], submatches[0])
		})

	vendorPatches := []Patch{
		{
			Name:  "Spicetify.URI",
			Regex: `,(\w+)\.prototype\.toAppType`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf(`,(globalThis.Spicetify.URI=%s)%s`, submatches[1], submatches[0])
			},
		},
		{
			Name:  "Map styled-components classes",
			Regex: `(\w+ [\w$_]+)=[\w$_]+\([\w$_]+>>>0\)`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%s=Spicetify._getStyledClassName(arguments,this)", submatches[1])
			},
		},
		{
			Name:  "Tippy.js",
			Regex: `([\w\$_]+)\.setDefaultProps=`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("Spicetify.Tippy=%s;%s", submatches[1], submatches[0])
			},
		},
		{
			Name:  "Flipper components",
			Regex: `([\w$]+)=((?:function|\()([\w$.,{}()= ]+(?:springConfig|overshootClamping)){2})`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("%s=Spicetify.ReactFlipToolkit.spring=%s", submatches[1], submatches[2])
			},
		},
		{
			// https://github.com/iamhosseindhv/notistack
			Name:  "Snackbar",
			Regex: `\w+\s*=\s*\w\.call\(this,[^)]+\)\s*\|\|\s*this\)\.enqueueSnackbar`,
			Replacement: func(submatches ...string) string {
				return fmt.Sprintf("Spicetify.Snackbar=%s", submatches[0])
			},
		},
	}

	// URI after 1.2.4
	if !strings.Contains(input, "Spicetify.URI") {
		URIObj := regexp.MustCompile(`(?:class ([\w$_]+)\{constructor|([\w$_]+)=function\(\)\{function ?[\w$_]+)\([\w$.,={}]+\)\{[\w !?:=.,>&(){}[\];]*this\.hasBase62Id`).FindStringSubmatch(input)

		if len(URIObj) != 0 {
			URI := utils.SeekToCloseParen(
				input,
				`\{(?:constructor|function ?[\w$_]+)\([\w$.,={}]+\)\{[\w !?:=.,>&(){}[\];]*this\.hasBase62Id`,
				'{', '}')

			if URIObj[1] == "" {
				URIObj[1] = URIObj[2]
				// Class is a self-invoking function
				URI = fmt.Sprintf("%s()", URI)
			}

			input = strings.Replace(
				input,
				URI,
				fmt.Sprintf("%s;Spicetify.URI=%s;", URI, URIObj[1]),
				1)
		}
	}

	return applyPatches(input, vendorPatches, report)
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
		return [3]int{}, errors.New("invalid version string")
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

func FetchLatestTagMatchingOrMain(version string) (string, error) {
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
	// major version matches latest, use main branch
	if ver[0] == versionS[0] && ver[1] == versionS[1] {
		return "main", nil
	} else {
		return FetchLatestTagMatchingVersion(version)
	}
}

func FetchLatestTagMatchingVersion(version string) (string, error) {
	if version == "Dev" {
		return "Dev", nil
	}
	res, err := http.Get("https://api.github.com/repos/spicetify/cli/releases")
	if err != nil {
		return "", err
	}

	body, err := io.ReadAll(res.Body)
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
