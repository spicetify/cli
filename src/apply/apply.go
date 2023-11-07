package apply

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spicetify/spicetify-cli/src/utils"
)

// Flag enables/disables additional feature
type Flag struct {
	CurrentTheme          string
	ColorScheme           string
	InjectThemeJS         bool
	CheckSpicetifyUpgrade bool
	Extension             []string
	CustomApp             []string
	SidebarConfig         bool
	HomeConfig            bool
	ExpFeatures           bool
	SpicetifyVer          string
	SpotifyVer            string
}

// AdditionalOptions .
func AdditionalOptions(appsFolderPath string, flags Flag) {
	filesToModified := map[string]func(path string, flags Flag){
		filepath.Join(appsFolderPath, "xpui", "index.html"):             htmlMod,
		filepath.Join(appsFolderPath, "xpui", "xpui.js"):                insertCustomApp,
		filepath.Join(appsFolderPath, "xpui", "vendor~xpui.js"):         insertExpFeatures,
		filepath.Join(appsFolderPath, "xpui", "home-v2.js"):             insertHomeConfig,
		filepath.Join(appsFolderPath, "xpui", "xpui-desktop-modals.js"): insertVersionInfo,
	}

	for file, call := range filesToModified {
		if _, err := os.Stat(file); os.IsNotExist(err) {
			continue
		}

		call(file, flags)
	}

	if flags.SidebarConfig {
		utils.CopyFile(
			filepath.Join(utils.GetJsHelperDir(), "sidebarConfig.js"),
			filepath.Join(appsFolderPath, "xpui", "helper"))
	}

	if flags.HomeConfig {
		utils.CopyFile(
			filepath.Join(utils.GetJsHelperDir(), "homeConfig.js"),
			filepath.Join(appsFolderPath, "xpui", "helper"))
	}

	if flags.ExpFeatures {
		utils.CopyFile(
			filepath.Join(utils.GetJsHelperDir(), "expFeatures.js"),
			filepath.Join(appsFolderPath, "xpui", "helper"))
	}
}

// UserCSS creates colors.css user.css files in "xpui".
// To not use custom css, set `themeFolder` to blank string
// To use default color scheme, set `scheme` to `nil`
func UserCSS(appsFolderPath, themeFolder string, scheme map[string]string) {
	colorsDest := filepath.Join(appsFolderPath, "xpui", "colors.css")
	if err := os.WriteFile(colorsDest, []byte(getColorCSS(scheme)), 0700); err != nil {
		utils.Fatal(err)
	}
	cssDest := filepath.Join(appsFolderPath, "xpui", "user.css")
	if err := os.WriteFile(cssDest, []byte(getUserCSS(themeFolder)), 0700); err != nil {
		utils.Fatal(err)
	}
}

// UserAsset .
func UserAsset(appsFolderPath, themeFolder string) {
	var assetsPath = getAssetsPath(themeFolder)
	var xpuiPath = filepath.Join(appsFolderPath, "xpui")
	if err := utils.Copy(assetsPath, xpuiPath, true, nil); err != nil {
		utils.Fatal(err)
	}
}

func htmlMod(htmlPath string, flags Flag) {
	if len(flags.Extension) == 0 &&
		!flags.HomeConfig &&
		!flags.SidebarConfig &&
		!flags.ExpFeatures {
		return
	}

	extensionsHTML := "\n"
	helperHTML := "\n"

	if flags.InjectThemeJS {
		extensionsHTML += `<script defer src="extensions/theme.js"></script>` + "\n"
	}

	if flags.SidebarConfig {
		helperHTML += `<script defer src="helper/sidebarConfig.js"></script>` + "\n"
	}

	if flags.HomeConfig {
		helperHTML += `<script defer src="helper/homeConfig.js"></script>` + "\n"
	}

	if flags.ExpFeatures {
		helperHTML += `<script defer src="helper/expFeatures.js"></script>` + "\n"
	}

	if flags.SpicetifyVer != "" {
		var extList string
		for _, ext := range flags.Extension {
			extList += `"` + ext + `",`
		}

		var customAppList string
		for _, app := range flags.CustomApp {
			customAppList += `"` + app + `",`
		}

		helperHTML += fmt.Sprintf(`<script>
			Spicetify.Config={};
			Spicetify.Config["version"]="%s";
			Spicetify.Config["current_theme"]="%s";
			Spicetify.Config["color_scheme"]="%s";
			Spicetify.Config["extensions"] = [%s];
			Spicetify.Config["custom_apps"] = [%s];
			Spicetify.Config["check_spicetify_upgrade"]=%v;
		</script>
		`, flags.SpicetifyVer, flags.CurrentTheme, flags.ColorScheme, extList, customAppList, flags.CheckSpicetifyUpgrade)
	}

	for _, v := range flags.Extension {
		if strings.HasSuffix(v, ".mjs") {
			extensionsHTML += `<script defer type="module" src="extensions/` + v + `"></script>` + "\n"
		} else {
			extensionsHTML += `<script defer src="extensions/` + v + `"></script>` + "\n"
		}
	}

	for _, v := range flags.CustomApp {
		manifest, _, err := utils.GetAppManifest(v)
		if err == nil {
			for _, extensionFile := range manifest.ExtensionFiles {
				if strings.HasSuffix(extensionFile, ".mjs") {
					extensionsHTML += `<script defer type="module" src="extensions/` + v + `/` + extensionFile + `"></script>` + "\n"
				} else {
					extensionsHTML += `<script defer src="extensions/` + v + `/` + extensionFile + `"></script>` + "\n"
				}
			}
		}
	}

	utils.ModifyFile(htmlPath, func(content string) string {
		utils.Replace(
			&content,
			`<\!-- spicetify helpers -->`,
			"${0}"+helperHTML)
		utils.Replace(
			&content,
			`</body>`,
			extensionsHTML+"${0}")
		return content
	})
}

func getUserCSS(themeFolder string) string {
	if len(themeFolder) == 0 {
		return ""
	}

	cssFilePath := filepath.Join(themeFolder, "user.css")
	_, err := os.Stat(cssFilePath)

	if err != nil {
		return ""
	}

	content, err := os.ReadFile(cssFilePath)
	if err != nil {
		return ""
	}

	return string(content)
}

func getColorCSS(scheme map[string]string) string {
	var variableList string
	var variableRGBList string
	mergedScheme := make(map[string]string)

	for k, v := range scheme {
		mergedScheme[k] = v
	}

	for k, v := range utils.BaseColorList {
		if len(mergedScheme[k]) == 0 {
			mergedScheme[k] = v
		}
	}

	for k, v := range mergedScheme {
		parsed := utils.ParseColor(v)
		variableList += fmt.Sprintf("    --spice-%s: #%s;\n", k, parsed.Hex())
		variableRGBList += fmt.Sprintf("    --spice-rgb-%s: %s;\n", k, parsed.RGB())
	}

	return fmt.Sprintf(":root {\n%s\n%s\n}\n", variableList, variableRGBList)
}

func insertCustomApp(jsPath string, flags Flag) {
	utils.ModifyFile(jsPath, func(content string) string {
		const REACT_REGEX = `(\w+(?:\(\))?)\.lazy\(\((?:\(\)=>|function\(\)\{return )(\w+)\.(\w+)\(\d+\)\.then\(\w+\.bind\(\w+,\d+\)\)\}?\)\)`
		const REACT_ELEMENT_REGEX = `(\w+(?:\(\))?\.createElement|\([\w$\.,]+\))\(([\w\.]+),\{path:"\/collection"(?:,(element|children)?[:.\w,{}()/*"]+)?\}`
		reactSymbs := utils.FindSymbol(
			"Custom app React symbols",
			content,
			[]string{
				REACT_REGEX})
		eleSymbs := utils.FindSymbol(
			"Custom app React Element",
			content,
			[]string{
				REACT_ELEMENT_REGEX})

		if (len(reactSymbs) < 2) || (len(eleSymbs) == 0) {
			utils.PrintError("Spotify version mismatch with Spicetify\nSpicetify currently only supports until Spotify v" + flags.SpotifyVer)
			return content
		}

		appMap := ""
		appReactMap := ""
		appEleMap := ""
		cssEnableMap := ""
		appNameArray := ""

		// Spotify's new route system
		wildcard := ""
		if eleSymbs[2] == "" {
			eleSymbs[2] = "children"
		} else if eleSymbs[2] == "element" {
			wildcard = "*"
		}

		for index, app := range flags.CustomApp {
			appName := `spicetify-routes-` + app
			appMap += fmt.Sprintf(`"%s":"%s",`, appName, appName)
			appNameArray += fmt.Sprintf(`"%s",`, app)

			appReactMap += fmt.Sprintf(
				`,spicetifyApp%d=%s.lazy((()=>%s.%s("%s").then(%s.bind(%s,"%s"))))`,
				index, reactSymbs[0], reactSymbs[1], reactSymbs[2],
				appName, reactSymbs[1], reactSymbs[1], appName)

			appEleMap += fmt.Sprintf(
				`%s(%s,{path:"/%s/%s",pathV6:"/%s/*",%s:%s(spicetifyApp%d,{})}),`,
				eleSymbs[0], eleSymbs[1], app, wildcard, app, eleSymbs[2], eleSymbs[0], index)

			cssEnableMap += fmt.Sprintf(`,"%s":1`, appName)
		}

		utils.Replace(
			&content,
			`\{(\d+:"xpui)`,
			`{`+appMap+`${1}`)

		utils.ReplaceOnce(
			&content,
			REACT_REGEX,
			`${0}`+appReactMap)

		utils.ReplaceOnce(
			&content,
			REACT_ELEMENT_REGEX,
			appEleMap+`${0}`)

		utils.Replace(
			&content,
			`(?:\w+(?:\(\))?\.createElement|\([\w$\.,]+\))\("li",\{className:[\w$\.]+\}?,(?:children:)?[\w$\.,()]+\(\w+,\{uri:"spotify:user:@:collection",to:"/collection"`,
			`Spicetify._sidebarItemToClone=${0}`)

		utils.Replace(
			&content,
			`(?:\w+(?:\(\))?\.createElement|\([\w$.,_]+\))\("li",{className:[-\w".${}()?!:, ]+,children:(?:\w+(?:\(\))?\.createElement|\([\w$.,_]+\))\([\w$._]+,{label:[-\w".${}()?!:, ]+,(\w+:[-\w".${}()?!&: ]+,)*children:(?:\w+(?:\(\))?\.createElement|\([\w$.,_]+\))\([\w$._]+,\{to:"/search"`,
			`Spicetify._sidebarXItemToClone=${0}`)

		utils.ReplaceOnce(
			&content,
			`\d+:1,\d+:1,\d+:1`,
			"${0}"+cssEnableMap)

		sidebarItemMatch := utils.SeekToCloseParen(
			content,
			`\("li",\{className:[\w$\.]+\}?,(?:children:)?[\w$\.,()]+\(\w+,\{uri:"spotify:user:@:collection",to:"/collection"`,
			'(', ')')

		// Prevent breaking on future Spotify update
		if sidebarItemMatch != "" {
			content = strings.Replace(
				content,
				sidebarItemMatch,
				sidebarItemMatch+",Spicetify._cloneSidebarItem(["+appNameArray+"])",
				1)
		}

		sidebarXItemMatch := utils.SeekToCloseParen(
			content,
			`\("li",{className:[-\w".${}()?!:, ]+,children:(?:\w+(?:\(\))?\.createElement|\([\w$.,_]+\))\([\w$._]+,{label:[-\w".${}()?!:, ]+,(\w+:[-\w".${}()?!&: ]+,)*children:(?:\w+(?:\(\))?\.createElement|\([\w$.,_]+\))\([\w$._]+,\{to:"/search"`,
			'(', ')')

		// Prevent breaking on future Spotify update
		if sidebarXItemMatch != "" {
			content = strings.Replace(
				content,
				sidebarXItemMatch,
				sidebarXItemMatch+",Spicetify._cloneSidebarItem(["+appNameArray+"],true)",
				1)
		} else {
			utils.PrintWarning("Sidebar X item not found, ignoring")
		}

		if flags.SidebarConfig {
			utils.ReplaceOnce(
				&content,
				`return null!=\w+&&\w+\.totalLength(\?\w+\(\)\.createElement\(\w+,\{contextUri:)(\w+)\.uri`,
				`return true${1}${2}?.uri||""`)
		}

		if flags.ExpFeatures {
			utils.ReplaceOnce(
				&content,
				`(([\w$.]+\.fromJSON)\(\w+\)+;)(return ?[\w{}().,]+[\w$]+\.Provider,)(\{value:\{localConfiguration)`,
				`${1}Spicetify.createInternalMap=${2};${3}Spicetify.RemoteConfigResolver=${4}`)
		}

		return content
	})
}

func insertHomeConfig(jsPath string, flags Flag) {
	if !flags.HomeConfig {
		return
	}

	utils.ModifyFile(jsPath, func(content string) string {
		utils.ReplaceOnce(
			&content,
			`([\w$_\.]+\.sections\.items)(\.map)`,
			`SpicetifyHomeConfig.arrange(${1})${2}`)
		return content
	})
}

func getAssetsPath(themeFolder string) string {
	dir := filepath.Join(themeFolder, "assets")

	if _, err := os.Stat(dir); err != nil {
		return ""
	}

	return dir
}

func insertExpFeatures(jsPath string, flags Flag) {
	if !flags.ExpFeatures {
		return
	}

	utils.ModifyFile(jsPath, func(content string) string {
		utils.ReplaceOnce(
			&content,
			`(function \w+\((\w+)\)\{)(\w+ \w+=\w\.name;if\("internal")`,
			`${1}${2}=Spicetify.expFeatureOverride(${2});${3}`)
		return content
	})
}

func insertVersionInfo(jsPath string, flags Flag) {
	utils.ModifyFile(jsPath, func(content string) string {
		utils.ReplaceOnce(
			&content,
			`(\w+(?:\(\))?\.createElement|\([\w$\.,]+\))\([\w\."]+,[\w{}():,]+\.containerVersion\}?\),`,
			`${0}${1}("details",{children: [
				${1}("summary",{children: "Spicetify v" + Spicetify.Config.version}),
				${1}("li",{children: "Theme: " + Spicetify.Config.current_theme + (Spicetify.Config.color_scheme && " / ") + Spicetify.Config.color_scheme}),
				${1}("li",{children: "Extensions: " + Spicetify.Config.extensions.join(", ")}),
				${1}("li",{children: "Custom apps: " + Spicetify.Config.custom_apps.join(", ")}),
				]}),`)
		return content
	})
}
