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
	"strconv"
	"strings"

	"github.com/spicetify/spicetify-cli/src/utils"
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
}

func readRemoteCssMap(tag string, cssTranslationMap *map[string]string) error {
	var cssMapURL string = "https://raw.githubusercontent.com/spicetify/spicetify-cli/" + tag + "/css-map.json"
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
				if flags.DisableSentry && fileName == "xpui.js" {
					content = disableSentry(content)
				}

				if flags.DisableLogging {
					content = disableLogging(content)
				}

				if flags.ExposeAPIs {
					switch fileName {
					case "xpui.js":
						content = exposeAPIs_main(content)
					case "vendor~xpui.js":
						content = exposeAPIs_vendor(content)
					}
				}
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
				for k, v := range cssTranslationMap {
					utils.Replace(&content, k, func(submatches ...string) string {
						return v
					})
				}
				if flags.RemoveRTL {
					content = removeRTL(content)
				}
				if fileName == "xpui.css" {
					content = content + `
					.main-gridContainer-fixedWidth{grid-template-columns: repeat(auto-fill, var(--column-width));width: calc((var(--column-count) - 1) * var(--grid-gap)) + var(--column-count) * var(--column-width));}.main-cardImage-imageWrapper{background-color: var(--card-color, #333);border-radius: 6px;-webkit-box-shadow: 0 8px 24px rgba(0, 0, 0, .5);box-shadow: 0 8px 24px rgba(0, 0, 0, .5);padding-bottom: 100%;position: relative;width:100%;}.main-cardImage-image,.main-card-imagePlaceholder{height: 100%;left: 0;position: absolute;top: 0;width: 100%}
					`
				}
				return content
			})

		case ".html":
			utils.ModifyFile(path, func(content string) string {
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
		return nil
	})
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
			utils.ModifyFile(path, colorVariableReplace)
		}
		return nil
	})
}

func colorVariableReplace(content string) string {
	utils.Replace(&content, "#181818", func(submatches ...string) string {
		return "var(--spice-player)"
	})
	utils.Replace(&content, "#212121", func(submatches ...string) string {
		return "var(--spice-player)"
	})

	utils.Replace(&content, "#282828", func(submatches ...string) string {
		return "var(--spice-card)"
	})

	utils.Replace(&content, "#121212", func(submatches ...string) string {
		return "var(--spice-main)"
	})
	utils.Replace(&content, "#242424", func(submatches ...string) string {
		return "var(--spice-main-elevated)"
	})

	utils.Replace(&content, "#1a1a1a", func(submatches ...string) string {
		return "var(--spice-highlight)"
	})
	utils.Replace(&content, "#2a2a2a", func(submatches ...string) string {
		return "var(--spice-highlight-elevated)"
	})

	utils.Replace(&content, "#000", func(submatches ...string) string {
		return "var(--spice-sidebar)"
	})
	utils.Replace(&content, "#000000", func(submatches ...string) string {
		return "var(--spice-sidebar)"
	})

	utils.Replace(&content, "white;", func(submatches ...string) string {
		return " var(--spice-text);"
	})
	utils.Replace(&content, "#fff", func(submatches ...string) string {
		return "var(--spice-text)"
	})
	utils.Replace(&content, "#ffffff", func(submatches ...string) string {
		return "var(--spice-text)"
	})
	utils.Replace(&content, "#f8f8f8", func(submatches ...string) string {
		return "var(--spice-text)"
	})

	utils.Replace(&content, "#b3b3b3", func(submatches ...string) string {
		return "var(--spice-subtext)"
	})
	utils.Replace(&content, "#a7a7a7", func(submatches ...string) string {
		return "var(--spice-subtext)"
	})

	utils.Replace(&content, "#1db954", func(submatches ...string) string {
		return "var(--spice-button)"
	})
	utils.Replace(&content, "#1877f2", func(submatches ...string) string {
		return "var(--spice-button)"
	})

	utils.Replace(&content, "#1ed760", func(submatches ...string) string {
		return "var(--spice-button-active)"
	})
	utils.Replace(&content, "#1fdf64", func(submatches ...string) string {
		return "var(--spice-button-active)"
	})
	utils.Replace(&content, "#169c46", func(submatches ...string) string {
		return "var(--spice-button-active)"
	})

	utils.Replace(&content, "#535353", func(submatches ...string) string {
		return "var(--spice-button-disabled)"
	})

	utils.Replace(&content, "#333", func(submatches ...string) string {
		return "var(--spice-tab-active)"
	})
	utils.Replace(&content, "#333333", func(submatches ...string) string {
		return "var(--spice-tab-active)"
	})

	utils.Replace(&content, "#7f7f7f", func(submatches ...string) string {
		return "var(--spice-misc)"
	})

	utils.Replace(&content, "#4687d6", func(submatches ...string) string {
		return "var(--spice-notification)"
	})
	utils.Replace(&content, "#2e77d0", func(submatches ...string) string {
		return "var(--spice-notification)"
	})

	utils.Replace(&content, "#e22134", func(submatches ...string) string {
		return "var(--spice-notification-error)"
	})
	utils.Replace(&content, "#cd1a2b", func(submatches ...string) string {
		return "var(--spice-notification-error)"
	})

	utils.Replace(&content, `rgba\(18,18,18,([\d\.]+)\)`, func(submatches ...string) string {
		return fmt.Sprintf("rgba(var(--spice-main),%s)", submatches[1])
	})
	utils.Replace(&content, `rgba\(40,40,40,([\d\.]+)\)`, func(submatches ...string) string {
		return fmt.Sprintf("rgba(var(--spice-card),%s)", submatches[1])
	})
	utils.Replace(&content, `rgba\(0,0,0,([\d\.]+)\)`, func(submatches ...string) string {
		return fmt.Sprintf("rgba(var(--spice-rgb-shadow),%s)", submatches[1])
	})
	utils.Replace(&content, `hsla\(0,0%,100%,\.9\)`, func(submatches ...string) string {
		return "rgba(var(--spice-rgb-text),.9)"
	})
	utils.Replace(&content, `hsla\(0,0%,100%,([\d\.]+)\)`, func(submatches ...string) string {
		return fmt.Sprintf("rgba(var(--spice-rgb-selected-row),%s)", submatches[1])
	})

	return content
}

func colorVariableReplaceForJS(content string) string {
	utils.Replace(&content, `"#1db954"`, func(submatches ...string) string {
		return ` getComputedStyle(document.body).getPropertyValue("--spice-button").trim()`
	})
	utils.Replace(&content, `"#b3b3b3"`, func(submatches ...string) string {
		return ` getComputedStyle(document.body).getPropertyValue("--spice-subtext").trim()`
	})
	utils.Replace(&content, `"#ffffff"`, func(submatches ...string) string {
		return ` getComputedStyle(document.body).getPropertyValue("--spice-text").trim()`
	})
	utils.Replace(&content, `color:"white"`, func(submatches ...string) string {
		return `color:"var(--spice-text)"`
	})
	return content
}

func disableSentry(input string) string {
	utils.Replace(&input, `(\("[^"]+sentry.io)/`, func(submatches ...string) string {
		return fmt.Sprintf(",%s", submatches[0])
	})
	return input
}

func disableLogging(input string) string {
	utils.Replace(&input, `sp://logging/v3/\w+`, func(submatches ...string) string {
		return ""
	})
	utils.Replace(&input, `[^"\/]+\/[^"\/]+\/(public\/)?v3\/events`, func(submatches ...string) string {
		return ""
	})

	utils.Replace(&input, `key:"registerEventListeners",value:function\(\)\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `key:"logInteraction",value:function\([\w,]+\)\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn {interactionId:null,pageInstanceId:null};", submatches[0])
	})
	utils.Replace(&input, `key:"logNonAuthInteraction",value:function\([\w,]+\)\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn {interactionId:null,pageInstanceId:null};", submatches[0])
	})
	utils.Replace(&input, `key:"logImpression",value:function\([\w,]+\)\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `key:"logNonAuthImpression",value:function\([\w,]+\)\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `key:"logNavigation",value:function\([\w,]+\)\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `key:"handleBackgroundStates",value:function\(\)\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `key:"createLoggingParams",value:function\([\w,]+\)\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `key:"initSendingEvents",value:function\(\)\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `key:"flush",value:function\(\)\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `(\{key:"send",value:function\([\w,]+\))\{[\d\w\s,{}()[\]\.,!\?=>&|;:_""]+?\}(\},\{key:"hasContext")`, func(submatches ...string) string {
		return fmt.Sprintf("%s{return;}%s", submatches[1], submatches[2])
	})
	utils.Replace(&input, `key:"lastFlush",value:function\(\)\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn Promise.resolve({fired:true});", submatches[0])
	})
	utils.Replace(&input, `key:"addItemInEventsStorage",value:function\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `key:"createLoggingParams",value:function\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn {interactionIds:null,pageInstanceIds:null};", submatches[0])
	})
	utils.Replace(&input, `key:"addEventsToESSData",value:function\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})

	utils.Replace(&input, `registerEventListeners\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `logInteraction\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn {interactionId:null,pageInstanceId:null};", submatches[0])
	})
	utils.Replace(&input, `logImpression\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `logNavigation\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `handleBackgroundStates\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `initSendingEvents\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `sendEvents\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `storeEvent\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `lastFlush\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn Promise.resolve({fired:true});", submatches[0])
	})
	utils.Replace(&input, `addItemInEventsStorage\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})
	utils.Replace(&input, `createLoggingParams\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn {interactionIds:null,pageInstanceIds:null};", submatches[0])
	})
	utils.Replace(&input, `addEventsToESSData\([^)]*\)\s*\{`, func(submatches ...string) string {
		return fmt.Sprintf("%sreturn;", submatches[0])
	})

	return input
}

func removeRTL(input string) string {
	utils.Replace(&input, `}\[dir=ltr\]\s?`, func(submatches ...string) string {
		return "} "
	})
	utils.Replace(&input, `html\[dir=ltr\]`, func(submatches ...string) string {
		return "html"
	})
	utils.Replace(&input, `,\s?\[dir=rtl\].+?(\{.+?\})`, func(submatches ...string) string {
		return submatches[1]
	})
	utils.Replace(&input, `[\w\-\.]+\[dir=rtl\].+?\{.+?\}`, func(submatches ...string) string {
		return ""
	})
	utils.Replace(&input, `\}\[lang=ar\].+?\{.+?\}`, func(submatches ...string) string {
		return "}"
	})
	utils.Replace(&input, `\}\[dir=rtl\].+?\{.+?\}`, func(submatches ...string) string {
		return "}"
	})
	utils.Replace(&input, `\}html\[dir=rtl\].+?\{.+?\}`, func(submatches ...string) string {
		return "}"
	})
	utils.Replace(&input, `\}html\[lang=ar\].+?\{.+?\}`, func(submatches ...string) string {
		return "}"
	})
	utils.Replace(&input, `\[lang=ar\].+?\{.+?\}`, func(submatches ...string) string {
		return ""
	})
	utils.Replace(&input, `html\[dir=rtl\].+?\{.+?\}`, func(submatches ...string) string {
		return ""
	})
	utils.Replace(&input, `html\[lang=ar\].+?\{.+?\}`, func(submatches ...string) string {
		return ""
	})
	utils.Replace(&input, `\[dir=rtl\].+?\{.+?\}`, func(submatches ...string) string {
		return ""
	})

	return input
}

func exposeAPIs_main(input string) string {
	// Show Notification
	utils.Replace(
		&input,
		`(?:\w+ |,)([\w$]+)=(\([\w$]+=[\w$]+\.dispatch)`,
		func(submatches ...string) string {
			return fmt.Sprintf(`;globalThis.Spicetify.showNotification=(message,isError=false,msTimeout)=>%s({message,feedbackType:isError?"ERROR":"NOTICE",msTimeout});const %s=%s`, submatches[1], submatches[1], submatches[2])
		})

	// Remove list of exclusive shows
	utils.Replace(
		&input,
		`\["spotify:show.+?\]`,
		func(submatches ...string) string {
			return "[]"
		})

	// Remove Star Wars easter eggs since it aggressively
	// listens to keystroke, checking URIs at all time
	// TODO: to fix
	utils.Replace(
		&input,
		`\w+\(\)\.createElement\(\w+,\{onChange:this\.handleSaberStateChange\}\),`,
		func(submatches ...string) string {
			return ""
		})

	utils.Replace(
		&input,
		`"data-testid":`,
		func(submatches ...string) string {
			return `"":`
		})

	// Spicetify._platform
	utils.Replace(
		&input,
		`(setTitlebarHeight[\w(){}.,&$!=;"" ]+)(\{version:[\w$]+,)`,
		func(submatches ...string) string {
			return fmt.Sprintf("%sSpicetify._platform=%s", submatches[1], submatches[2])
		})

	// Redux store
	utils.Replace(
		&input,
		`(,[\w$]+=)(([$\w,.:=;(){}]+\(\{session:[\w$]+,features:[\w$]+,seoExperiment:[\w$]+\}))`,
		func(submatches ...string) string {
			return fmt.Sprintf("%sSpicetify.Platform.ReduxStore=%s", submatches[1], submatches[2])
		})

	// React Component: Platform Provider
	utils.Replace(
		&input,
		`(,[$\w]+=)((function\([\w$]{1}\)\{var [\w$]+=[\w$]+\.platform,[\w$]+=[\w$]+\.children,)|(\(\{platform:[\w$]+,children:[\w$]+\}\)=>\{))`,
		func(submatches ...string) string {
			return fmt.Sprintf("%sSpicetify.ReactComponent.PlatformProvider=%s", submatches[1], submatches[2])
		})

	// Prevent breaking popupLyrics
	utils.Replace(
		&input,
		`document.pictureInPictureElement&&\(\w+.current=[!\w]+,document\.exitPictureInPicture\(\)\),\w+\.current=null`,
		func(submatches ...string) string {
			return ""
		})

	// GraphQL definitions <=1.2.30
	utils.Replace(
		&input,
		`((?:\w+ ?)?[\w$]+=)(\{kind:"Document",definitions:\[\{(?:\w+:[\w"]+,)+name:\{(?:\w+:[\w"]+,?)+value:("\w+"))`,
		func(submatches ...string) string {
			return fmt.Sprintf("%sSpicetify.GraphQL.Definitions[%s]=%s", submatches[1], submatches[3], submatches[2])
		})

	// GraphQL definitons >=1.2.31
	utils.Replace(
		&input,
		`(=new [\w_\$][\w_\$\d]*\.[\w_\$][\w_\$\d]*\("(\w+)","(query|mutation)","[\w\d]{64}",null\))`,
		func(submatches ...string) string {
			return fmt.Sprintf(`=Spicetify.GraphQL.Definitions["%s"]%s`, submatches[2], submatches[1])
		})

	utils.Replace(
		&input,
		`\b\w\s*\(\)\s*[^;,]*enqueueCustomSnackbar:\s*(\w)\s*[^;]*;`,
		func(submatches ...string) string {
			return fmt.Sprintf("%sSpicetify.Snackbar.enqueueCustomSnackbar=%s;", submatches[0], submatches[1])
		})

	utils.Replace(
		&input,
		`\(\({[^}]*,\s*imageSrc`,
		func(submatches ...string) string {
			return fmt.Sprintf("Spicetify.Snackbar.enqueueImageSnackbar=%s", submatches[0])
		})

	// Menu hook
	utils.Replace(&input, `("Menu".+?children:)([\w$][\w$\d]*)`, func(submatches ...string) string {
		return fmt.Sprintf("%s[Spicetify.ContextMenuV2.renderItems(),%s].flat()", submatches[1], submatches[2])
	})

	croppedInput := utils.FindFirstMatch(input, `"context-menu".*value:"contextmenu"`)[0]

	react := utils.FindFirstMatch(croppedInput, `([\w_$]+)\.useRef`)[1]
	var menu string
	var trigger string
	var target string

	menuCandidates := utils.FindMatch(croppedInput, `menu:([\w_$]+)`)
	if len(menuCandidates) == 0 {
		// v1.2.13 fix
		menu = utils.FindFirstMatch(croppedInput, `([\w_$]+)=[\w_$]+\.menu,`)[1]
		trigger = utils.FindFirstMatch(croppedInput, `([\w_$]+)=[\w_$]+\.trigger,`)[1]
		target = utils.FindFirstMatch(croppedInput, `([\w_$]+)=[\w_$]+\.triggerRef,`)[1]
	} else {
		menu = menuCandidates[0][1]
		trigger = utils.FindFirstMatch(croppedInput, `trigger:([\w_$]+)`)[1]
		target = utils.FindFirstMatch(croppedInput, `triggerRef:([\w_$]+)`)[1]
	}

	utils.Replace(&input, `\(0,([\w_$]+)\.jsx\)\([\w_$]+\.[\w_$]+,\{value:"contextmenu"[^\}]+\}\)\}\)`, func(submatches ...string) string {
		return fmt.Sprintf("(0,%s.jsx)((Spicetify.ContextMenuV2._context||(Spicetify.ContextMenuV2._context=%s.createContext(null))).Provider,{value:{props:%s?.props,trigger:%s,target:%s},children:%s})", submatches[1], react, menu, trigger, target, submatches[0])
	})

	return input
}

func exposeAPIs_vendor(input string) string {
	// URI
	utils.Replace(
		&input,
		`,(\w+)\.prototype\.toAppType`,
		func(submatches ...string) string {
			return fmt.Sprintf(`,(globalThis.Spicetify.URI=%s)%s`, submatches[1], submatches[0])
		})

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

	utils.ReplaceOnce(
		&input,
		`\(function\(\w+\)\{return \w+\.\$?variant\?function\(\w+\)\{`,
		func(submatches ...string) string {
			return fmt.Sprintf("Spicetify._fontStyle=%s", submatches[0])
		})

	// Mapping styled-components classes
	utils.Replace(
		&input,
		`(\w+ [\w$_]+)=[\w$_]+\([\w$_]+>>>0\)`,
		func(submatches ...string) string {
			return fmt.Sprintf("%s=Spicetify._getStyledClassName(arguments,this)", submatches[1])
		})

	// Tippy
	utils.Replace(
		&input,
		`([\w\$_]+)\.setDefaultProps=`,
		func(submatches ...string) string {
			return fmt.Sprintf("Spicetify.Tippy=%s;%s", submatches[1], submatches[0])
		})

	// Flipper components
	utils.Replace(
		&input,
		`([\w$]+)=((?:function|\()([\w$.,{}()= ]+(?:springConfig|overshootClamping)){2})`,
		func(submatches ...string) string {
			return fmt.Sprintf("%s=Spicetify.ReactFlipToolkit.spring=%s", submatches[1], submatches[2])
		})

	// Snackbar https://github.com/iamhosseindhv/notistack
	utils.Replace(
		&input,
		`\w+\s*=\s*\w\.call\(this,[^)]+\)\s*\|\|\s*this\)\.enqueueSnackbar`,
		func(submatches ...string) string {
			return fmt.Sprintf("Spicetify.Snackbar=%s", submatches[0])
		})

	return input
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
	res, err := http.Get("https://api.github.com/repos/spicetify/spicetify-cli/releases")
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
