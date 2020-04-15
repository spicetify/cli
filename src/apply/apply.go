package apply

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-ini/ini"
	"github.com/khanhas/spicetify-cli/src/utils"
)

// Flag enables/disables additional feature
type Flag struct {
	ExperimentalFeatures utils.TernaryBool
	FastUserSwitching    utils.TernaryBool
	Home                 utils.TernaryBool
	LyricAlwaysShow      utils.TernaryBool
	LyricForceNoSync     utils.TernaryBool
	Radio                utils.TernaryBool
	SongPage             utils.TernaryBool
	VisHighFramerate     utils.TernaryBool
	XPUI                 utils.TernaryBool
	TasteBuds            utils.TernaryBool
	Extension            []string
	CustomApp            []string
}

// AdditionalOptions .
func AdditionalOptions(appsFolderPath string, flags Flag) {
	appList, err := ioutil.ReadDir(appsFolderPath)

	if err != nil {
		log.Fatal(err)
	}

	for _, app := range appList {
		appName := app.Name()
		appPath := filepath.Join(appsFolderPath, appName)

		filepath.Walk(appPath, func(path string, info os.FileInfo, err error) error {
			fileName := info.Name()
			extension := filepath.Ext(fileName)

			switch extension {
			case ".js":
				switch fileName {
				case "lyrics.bundle.js":
					lyricsMod(path, flags)
				case "zlink.bundle.js":
					zlinkMod(path, flags)
				case "xpui.js":
					xpuiMod(path, flags)
				}
			case ".css":
			case ".html":
				if appName == "zlink" && len(flags.Extension) > 0 {
					utils.ModifyFile(path, func(content string) string {
						extensionsHTML := ""
						for _, v := range flags.Extension {
							if strings.HasSuffix(v, ".mjs") {
								extensionsHTML += `<script type="module" src="` + v + `"></script>` + "\n"
							} else {
								extensionsHTML += `<script src="` + v + `"></script>` + "\n"
							}
						}
						if len(extensionsHTML) > 0 {
							utils.Replace(
								&content,
								`<!\-\-Extension\-\->`,
								"${0}\n"+extensionsHTML,
							)
						}

						return content
					})
				}
			}
			return nil
		})
	}
}

// UserCSS .
func UserCSS(appsFolderPath, themeFolder string, injectCSS, customColor bool, scheme *ini.Section) {
	var userCSS string

	if customColor {
		userCSS += getColorCSS(scheme)
	} else {
		userCSS += getColorCSS(nil)
	}

	if injectCSS {
		userCSS += getUserCSS(themeFolder)
	}

	userCSSDestPath := filepath.Join(appsFolderPath, "zlink", "css", "user.css")
	if err := ioutil.WriteFile(userCSSDestPath, []byte(userCSS), 0700); err != nil {
		utils.Fatal(err)
	}

	// "login" app is initially loaded apps so it needs its own assets,
	// unlike other apps that are able to depend on zlink assets.
	userCSSDestPath = filepath.Join(appsFolderPath, "login", "css", "user.css")
	if err := ioutil.WriteFile(userCSSDestPath, []byte(userCSS), 0700); err != nil {
		utils.Fatal(err)
	}
}

// UserAsset .
func UserAsset(appsFolderPath, themeFolder string) {
	var assetsPath = getAssetsPath(themeFolder)

	if err := utils.Copy(assetsPath, appsFolderPath, true, nil); err != nil {
		utils.Fatal(err)
	}
}

func lyricsMod(jsPath string, flags Flag) {
	utils.ModifyFile(jsPath, func(content string) string {
		if !flags.VisHighFramerate.IsDefault() {
			utils.Replace(&content, `[\w_]+\.highVisualizationFrameRate\s?=`, `${0}`+flags.VisHighFramerate.ToForceOperator())
		}

		if !flags.LyricForceNoSync.IsDefault() {
			utils.Replace(&content, `[\w_]+\.forceNoSyncLyrics\s?=`, `${0}`+flags.LyricForceNoSync.ToForceOperator())
		}

		return content
	})
}

func zlinkMod(jsPath string, flags Flag) {
	utils.ModifyFile(jsPath, func(content string) string {
		if !flags.ExperimentalFeatures.IsDefault() {
			utils.Replace(&content, `[\w_]+(&&[\w_]+\.default.createElement\([\w_]+\.default,\{name:"experiments)`, flags.ExperimentalFeatures.ToString()+`${1}`)
		}

		if !flags.FastUserSwitching.IsDefault() {
			utils.Replace(&content, `[\w_]+(&&[\w_]+\.default.createElement\([\w_]+\.default,\{name:"switch\-user)`, flags.FastUserSwitching.ToString()+`${1}`)
		}

		if !flags.Home.IsDefault() {
			utils.Replace(&content, `(isHomeEnabled:)("Enabled")`, `${1}`+flags.Home.ToForceOperator()+`${2}`)
		}

		if !flags.LyricAlwaysShow.IsDefault() {
			utils.Replace(&content, `(lyricsEnabled\()[\w_]+&&\(.+?\)`, `${1}`+flags.LyricAlwaysShow.ToString())
		}

		if !flags.Radio.IsDefault() {
			utils.Replace(&content, `"1"===[\w_]+\.productState\.radio`, flags.Radio.ToString())
		}

		if !flags.SongPage.IsDefault() {
			utils.Replace(&content, `window\.initialState\.isSongPageEnabled`, flags.SongPage.ToString())
		}

		if !flags.XPUI.IsDefault() {
			utils.Replace(&content, `(enableDarkMode:)("Enabled")`, `${1}`+flags.XPUI.ToForceOperator()+`${2}`)
		}

		if len(flags.CustomApp) > 0 {
			insertCustomApp(&content, flags.CustomApp)
		}

		return content
	})
}

func xpuiMod(jsPath string, flags Flag) {
	utils.ModifyFile(jsPath, func(content string) string {
		if !flags.TasteBuds.IsDefault() {
			utils.Replace(&content, `[\w_]\.features\.isTastebudzEnabled`, flags.TasteBuds.ToString())
		}

		return content
	})
}

func getUserCSS(themeFolder string) string {
	cssFilePath := filepath.Join(themeFolder, "user.css")
	_, err := os.Stat(cssFilePath)

	if err != nil {
		return ""
	}

	content, err := ioutil.ReadFile(cssFilePath)
	if err != nil {
		return ""
	}

	return string(content)
}

func getColorCSS(scheme *ini.Section) string {
	if scheme == nil {
		scheme = ini.Empty().Section("")
	}

	var variableList string

	for k, v := range utils.BaseColorList {
		parsed := utils.ParseColor(scheme.Key(k).MustString(v))
		variableList += fmt.Sprintf(`
    --modspotify_%s: #%s;
    --modspotify_rgb_%s: %s;`,
			k, parsed.Hex(),
			k, parsed.RGB())
	}

	return fmt.Sprintf(":root {%s\n}\n", variableList)
}

func insertCustomApp(zlinkContent *string, appList []string) {
	symbol1 := utils.FindSymbol("React and SidebarList", *zlinkContent, []string{
		`([\w_]+)\.default\.createElement\(([\w_]+)\.default,\{title:[\w_]+\.default\.get\("(?:desktop\.zlink\.)?your_music\.app_name"\)`,
	})
	if symbol1 == nil || len(symbol1) < 2 {
		utils.PrintError("Cannot find enough symbol for React and SidebarList.")
		return
	}

	symbol2 := utils.FindSymbol("Last requested URI", *zlinkContent, []string{
		`([\w_]+)\.default,{isActive:/\^spotify:app:home/\.test\(([\w_]+)\)`,
	})
	if symbol2 == nil || len(symbol2) < 2 {
		utils.PrintError("Cannot find enough symbol for Last requested URI.")
		return
	}

	react := symbol1[0]
	list := symbol1[1]

	element := symbol2[0]
	pageURI := symbol2[1]

	pageLogger := ""
	menuItems := ""

	for _, name := range appList {
		menuItems += react +
			`.default.createElement(` + element +
			`.default,{isActive:/^spotify:app:` + name +
			`(\:.*)?$/.test(` + pageURI +
			`),isBold:!0,label:"` + strings.Title(name) +
			`",uri:"spotify:app:` + name + `"}),`

		pageLogger += `"` + name + `":"` + name + `",`
	}

	utils.Replace(
		zlinkContent,
		`[\w_]+\.default\.createElement\([\w_]+\.default,\{title:[\w_]+\.default\.get\("(?:desktop\.zlink\.)?your_music\.app_name"`,
		react+`.default.createElement(`+list+
			`.default,{title:"Your app"},`+menuItems+`)),`+
			react+`.default.createElement("div",{className:"LeftSidebar__section"},${0}`,
	)

	utils.Replace(
		zlinkContent,
		`EMPTY:"empty"`,
		pageLogger+`${0}`,
	)
}

func getAssetsPath(themeFolder string) string {
	dir := filepath.Join(themeFolder, "assets")

	if _, err := os.Stat(dir); err != nil {
		return ""
	}

	return dir
}
