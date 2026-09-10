package apply

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/spicetify/cli/src/utils"
)

// Flag enables/disables additional feature
type Flag struct {
	CurrentTheme         string
	ColorScheme          string
	InjectThemeJS        bool
	CheckSpicetifyUpdate bool
	Extension            []string
	CustomApp            []string
	SidebarConfig        bool
	HomeConfig           bool
	ExpFeatures          bool
	SpicetifyVer         string
	SpotifyVer           string
}

// AdditionalOptions .
func AdditionalOptions(appsFolderPath string, flags Flag) {
	jsModifiers := []func(path string, flags Flag){
		insertExpFeatures,
		insertSidebarConfig,
		insertHomeConfig,
	}
	filesToModified := map[string][]func(path string, flags Flag){
		filepath.Join(appsFolderPath, "xpui", "index.html"): {
			htmlMod,
		},
		filepath.Join(appsFolderPath, "xpui", "xpui.js"):         jsModifiers,
		filepath.Join(appsFolderPath, "xpui", "xpui-modules.js"): jsModifiers,
		filepath.Join(appsFolderPath, "xpui", "home-v2.js"): {
			insertHomeConfig,
		},
		filepath.Join(appsFolderPath, "xpui", "xpui-desktop-modals.js"): {
			insertVersionInfo,
		},
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

	if len(flags.CustomApp) > 0 {
		if customAppTarget := findCustomAppTarget(appsFolderPath); customAppTarget != "" {
			filesToModified[customAppTarget] = append(filesToModified[customAppTarget], insertCustomApp)
			snapshotPath := filepath.Join(appsFolderPath, "xpui", "xpui-snapshot.js")
			if customAppTarget != snapshotPath {
				filesToModified[snapshotPath] = append(filesToModified[snapshotPath], insertCustomAppChunkMap)
			}
		} else {
			utils.PrintError("Spotify version mismatch with Spicetify. Please report it on our github repository.")
			utils.PrintInfo("Spicetify might have been updated for this version already. Please run `spicetify update` to check for a new version.")
			utils.PrintInfo("If one isn't available yet, please wait for an update to be released or downgrade Spotify to a supported version.")
		}
	}

	if spotifyMajor >= 1 && spotifyMinor >= 2 && spotifyPatch >= 57 {
		filesToModified[filepath.Join(appsFolderPath, "xpui", "xpui.js")] = append(filesToModified[filepath.Join(appsFolderPath, "xpui", "xpui.js")], insertExpFeatures)
	} else {
		filesToModified[filepath.Join(appsFolderPath, "xpui", "vendor~xpui.js")] = []func(string, Flag){insertExpFeatures}
	}

	if flags.SidebarConfig {
		if err := utils.CopyFile(
			filepath.Join(utils.GetJsHelperDir(), "sidebarConfig.js"),
			filepath.Join(appsFolderPath, "xpui", "helper")); err != nil {
			utils.PrintError(err.Error())
			flags.SidebarConfig = false
		}
	}

	if flags.HomeConfig {
		if err := utils.CopyFile(
			filepath.Join(utils.GetJsHelperDir(), "homeConfig.js"),
			filepath.Join(appsFolderPath, "xpui", "helper")); err != nil {
			utils.PrintError(err.Error())
			flags.HomeConfig = false
		}
	}

	if flags.ExpFeatures {
		if err := utils.CopyFile(
			filepath.Join(utils.GetJsHelperDir(), "expFeatures.js"),
			filepath.Join(appsFolderPath, "xpui", "helper")); err != nil {
			utils.PrintError(err.Error())
			flags.ExpFeatures = false
		}
	}

	for file, calls := range filesToModified {
		if _, err := os.Stat(file); os.IsNotExist(err) {
			continue
		}

		for _, call := range calls {
			call(file, flags)
		}
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

	var extensionsHTML strings.Builder
	var helperHTML strings.Builder
	extensionsHTML.WriteByte('\n')
	helperHTML.WriteByte('\n')

	if flags.InjectThemeJS {
		extensionsHTML.WriteString("<script defer src='extensions/theme.js'></script>\n")
	}

	if flags.SidebarConfig {
		helperHTML.WriteString("<script defer src='helper/sidebarConfig.js'></script>\n")
	}

	if flags.HomeConfig {
		helperHTML.WriteString("<script defer src='helper/homeConfig.js'></script>\n")
	}

	if flags.ExpFeatures {
		helperHTML.WriteString("<script defer src='helper/expFeatures.js'></script>\n")
	}

	if flags.SpicetifyVer != "" {
		var extList strings.Builder
		for _, ext := range flags.Extension {
			fmt.Fprintf(&extList, `"%s",`, ext)
		}

		var customAppList strings.Builder
		for _, app := range flags.CustomApp {
			fmt.Fprintf(&customAppList, `"%s",`, app)
		}

		fmt.Fprintf(&helperHTML, `<script>
			Spicetify.Config={};
			Spicetify.Config["version"]="%s";
			Spicetify.Config["current_theme"]="%s";
			Spicetify.Config["color_scheme"]="%s";
			Spicetify.Config["extensions"] = [%s];
			Spicetify.Config["custom_apps"] = [%s];
			Spicetify.Config["check_spicetify_update"]=%v;
		</script>
		`, flags.SpicetifyVer, flags.CurrentTheme, flags.ColorScheme, extList.String(), customAppList.String(), flags.CheckSpicetifyUpdate)
	}

	for _, v := range flags.Extension {
		if strings.HasSuffix(v, ".mjs") {
			fmt.Fprintf(&extensionsHTML, "<script defer type='module' src='extensions/%s'></script>\n", v)
		} else {
			fmt.Fprintf(&extensionsHTML, "<script defer src='extensions/%s'></script>\n", v)
		}
	}

	for _, v := range flags.CustomApp {
		manifest, _, err := utils.GetAppManifest(v)
		if err == nil {
			for _, extensionFile := range manifest.ExtensionFiles {
				if strings.HasSuffix(extensionFile, ".mjs") {
					fmt.Fprintf(&extensionsHTML, "<script defer type='module' src='extensions/%s/%s'></script>\n", v, extensionFile)
				} else {
					fmt.Fprintf(&extensionsHTML, "<script defer src='extensions/%s/%s'></script>\n", v, extensionFile)
				}
			}
		}
	}

	utils.ModifyFile(htmlPath, func(content string) string {
		utils.Replace(
			&content,
			`<script defer="defer" src="/xpui-snapshot\.js"></script>`,
			func(submatches ...string) string {
				return `<script defer="defer" src="/xpui-modules.js"></script><script defer="defer" src="/xpui-snapshot.js"></script>`
			})
		utils.Replace(
			&content,
			`<\!-- spicetify helpers -->`,
			func(submatches ...string) string {
				return fmt.Sprintf("%s%s", submatches[0], helperHTML.String())
			})
		utils.Replace(
			&content,
			`</body>`,
			func(submatches ...string) string {
				return fmt.Sprintf("%s%s", extensionsHTML.String(), submatches[0])
			})
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
	var variableList strings.Builder
	var variableRGBList strings.Builder
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
		fmt.Fprintf(&variableList, "    --spice-%s: #%s;\n", k, parsed.Hex())
		fmt.Fprintf(&variableRGBList, "    --spice-rgb-%s: %s;\n", k, parsed.RGB())
	}

	return fmt.Sprintf(":root {\n%s\n%s\n}\n", variableList.String(), variableRGBList.String())
}

func customAppReactPatterns() []string {
	return []string{
		// Sync pattern: X.lazy((() => Y.Z(123).then(W.bind(W, 456))))
		`([\w_\$][\w_\$\d]*(?:\(\))?)\.lazy\(\((?:\(\)=>|function\(\)\{return )(\w+)\.(\w+)\(["']?[\w-]+["']?\)\.then\(\w+\.bind\(\w+,["']?[\w-]+["']?\)\)\}?\)\)`,
		// Async pattern (1.2.78+): m.lazy(async()=>{...await o.e(123).then(...)})
		`([\w_\$][\w_\$\d]*)\.lazy\(async\(\)=>\{(?:[^{}]|\{[^{}]*\})*await\s+(\w+)\.(\w+)\(["']?[\w-]+["']?\)\.then\(\w+\.bind\(\w+,["']?[\w-]+["']?\)\)`,
		// Async Promise.all pattern (1.2.78+): m.lazy(async()=>await Promise.all([Y.Z(123),...]).then(...))
		// Capture the chunk loader from the first entry inside Promise.all, not from .bind()
		`([\w_\$][\w_\$\d]*(?:\(\))?)\.lazy\(async\(\)=>await\s+Promise\.all\(\[(\w+)\.(\w+)\(["']?[\w-]+["']?\)`,
	}
}

func customAppElementPatterns() []string {
	return []string{
		// JSX pattern (1.2.78+): (0,S.jsx)(se.qh,{path:"/collection/*",element:...})
		// Settings page should be more consistent with having no conditional renders
		`(\([\w$\.,]+\))\(([\w\.]+),\{path:"/settings(?:/[\w\*]+)?",?(element|children)?`,
		// createElement pattern: X.createElement(Y,{path:"/collection"...})
		`([\w_\$][\w_\$\d]*(?:\(\))?\.createElement|\([\w$\.,]+\))\(([\w\.]+),\{path:"\/collection"(?:,(element|children)?[:.\w,{}()$/*"]+)?\}`,
	}
}

func supportsCustomAppInjection(content string) bool {
	reactSymbs, _ := utils.FindSymbolWithPattern("", content, customAppReactPatterns())
	eleSymbs, _ := utils.FindSymbolWithPattern("", content, customAppElementPatterns())
	return len(reactSymbs) >= 3 && len(eleSymbs) >= 3
}

func findCustomAppTarget(appsFolderPath string) string {
	candidates := []string{
		filepath.Join(appsFolderPath, "xpui", "xpui-modules.js"),
		filepath.Join(appsFolderPath, "xpui", "xpui-snapshot.js"),
		filepath.Join(appsFolderPath, "xpui", "xpui.js"),
	}

	for _, candidate := range candidates {
		raw, err := os.ReadFile(candidate)
		if err != nil {
			continue
		}
		if supportsCustomAppInjection(string(raw)) {
			return candidate
		}
	}

	return ""
}

func getCustomAppChunkMaps(flags Flag) (string, string) {
	var appMap strings.Builder
	var cssEnableMap strings.Builder

	for _, app := range flags.CustomApp {
		appName := `spicetify-routes-` + app
		fmt.Fprintf(&appMap, `"%s":"%s",`, appName, appName)
		fmt.Fprintf(&cssEnableMap, `,"%s":1`, appName)
	}

	return appMap.String(), cssEnableMap.String()
}

func insertCustomAppChunkMap(jsPath string, flags Flag) {
	utils.ModifyFile(jsPath, func(content string) string {
		appMap, cssEnableMap := getCustomAppChunkMaps(flags)

		utils.Replace(
			&content,
			`\{(\d+:"xpui)`,
			func(submatches ...string) string {
				return fmt.Sprintf("{%s%s", appMap, submatches[1])
			})

		utils.ReplaceOnce(
			&content,
			`(\.u=\w+=>""\+\(\(\{)`,
			func(submatches ...string) string {
				return fmt.Sprintf("%s%s", submatches[1], appMap)
			})

		utils.ReplaceOnce(
			&content,
			`(\.f\.miniCss=function\(\w+,\w+(?:,\w+)?\).*?\(\{)([0-9:,]+)(\}\)\[\w+\])`,
			func(submatches ...string) string {
				return fmt.Sprintf("%s%s%s%s", submatches[1], submatches[2], cssEnableMap, submatches[3])
			})

		return content
	})
}

func insertCustomApp(jsPath string, flags Flag) {
	utils.ModifyFile(jsPath, func(content string) string {
		reactSymbs, matchedReactPattern := utils.FindSymbolWithPattern(
			"Custom app React symbols",
			content,
			customAppReactPatterns())
		eleSymbs, matchedElementPattern := utils.FindSymbolWithPattern(
			"Custom app React Element",
			content,
			customAppElementPatterns())

		if (len(reactSymbs) < 3) || (len(eleSymbs) < 3) {
			utils.PrintError("Spotify version mismatch with Spicetify. Please report it on our github repository.")
			utils.PrintInfo("Spicetify might have been updated for this version already. Please run `spicetify update` to check for a new version.")
			utils.PrintInfo("If one isn't available yet, please wait for an update to be released or downgrade Spotify to a supported version.")
			return content
		}

		var appReactMap strings.Builder
		var appEleMap strings.Builder
		var appNameArray strings.Builder
		var appMap strings.Builder
		var cssEnableMap strings.Builder

		// Spotify's new route system
		wildcard := ""
		if eleSymbs[2] == "" {
			eleSymbs[2] = "children"
		} else if eleSymbs[2] == "element" {
			wildcard = "*"
		}

		for index, app := range flags.CustomApp {
			appName := `spicetify-routes-` + app
			fmt.Fprintf(&appMap, `"%s":"%s",`, appName, appName)
			fmt.Fprintf(&appNameArray, `"%s",`, app)

			fmt.Fprintf(
				&appReactMap,
				`,spicetifyApp%d=%s.lazy((()=>%s.%s("%s").then(%s.bind(%s,"%s"))))`,
				index, reactSymbs[0], reactSymbs[1], reactSymbs[2],
				appName, reactSymbs[1], reactSymbs[1], appName)

			fmt.Fprintf(
				&appEleMap,
				`%s(%s,{path:"/%s/%s",pathV6:"/%s/*",%s:%s(spicetifyApp%d,{})}),`,
				eleSymbs[0], eleSymbs[1], app, wildcard, app, eleSymbs[2], eleSymbs[0], index)

			fmt.Fprintf(&cssEnableMap, `,"%s":1`, appName)
		}

		utils.Replace(
			&content,
			`\{(\d+:"xpui)`,
			func(submatches ...string) string {
				return fmt.Sprintf("{%s%s", appMap.String(), submatches[1])
			})

		// Seek to the full matched React.lazy pattern
		matchedReactPattern = utils.SeekToCloseParen(
			content,
			matchedReactPattern,
			'(',
			')',
		)

		content = strings.Replace(
			content,
			matchedReactPattern,
			fmt.Sprintf("%s%s", matchedReactPattern, appReactMap.String()),
			1,
		)

		utils.ReplaceOnce(
			&content,
			matchedElementPattern,
			func(submatches ...string) string {
				return fmt.Sprintf("%s%s", appEleMap.String(), submatches[0])
			})

		content = insertNavLink(content, appNameArray.String())

		utils.ReplaceOnce(
			&content,
			`\d+:1,\d+:1,\d+:1`,
			func(submatches ...string) string {
				return fmt.Sprintf("%s%s", submatches[0], cssEnableMap.String())
			})

		return content
	})
}

func insertNavLink(str string, appNameArray string) string {
	// Library X
	libraryXItemMatch := utils.SeekToCloseParen(
		str,
		`\("li",\{[^\{]*\{[^\{]*\{to:"\/search`,
		'(', ')')

	if libraryXItemMatch != "" {
		str = strings.Replace(
			str,
			libraryXItemMatch,
			fmt.Sprintf("%s,Spicetify._renderNavLinks([%s], false)", libraryXItemMatch, appNameArray),
			1)
	}

	utils.ReplaceOnceWithPriority(&str,
		[]string{
			// Global Navbar <= 1.2.45
			`(,[a-zA-Z_\$][\w\$]*===(?:[a-zA-Z_\$][\w\$]*\.){2}HOME_NEXT_TO_NAVIGATION&&.+?)\]`,
			// Global Navbar >= 1.2.60, greedy matching with enclosing brackets
			`("global-nav-bar".*[[\w\$&|]*\(0,[a-zA-Z_\$][\w\$]*\.jsx\)\(\s*\w+,\s*\{\s*className:\w*\s*\}\s*\))\]`,
			// Global Navbar >= 1.2.87
			`(?s)("global-nav-bar".*?&&\s*\(0,\s*[a-zA-Z_\$][\w\$]*\.jsxs?\)\(\s*[a-zA-Z_\$][\w\$]*\s*,\s*\{\s*children:\s*)(\[\s*[\w\$]+\s*\?\s*\(0,\s*[a-zA-Z_\$][\w\$]*\.jsx\).*?\])(\s*\}\))`,
			// Global Navbar >= 1.2.46, lazy matching
			`("global-nav-bar".*?)(\(0,\s*[a-zA-Z_\$][\w\$]*\.jsx\))(\(\s*\w+,\s*\{\s*className:\w*\s*\}\s*\))`,
		},
		func(index int, submatches ...string) string {
			switch index {
			case 0, 1:
				return fmt.Sprintf("%s,Spicetify._renderNavLinks([%s], true)]", submatches[1], appNameArray)
			case 2:
				return fmt.Sprintf("%s[%s,Spicetify._renderNavLinks([%s], true)].flat()%s", submatches[1], submatches[2], appNameArray, submatches[3])
			case 3:
				return fmt.Sprintf("%s[%s%s,Spicetify._renderNavLinks([%s], true)].flat()", submatches[1], submatches[2], submatches[3], appNameArray)
			}
			return ""
		},
	)

	return str
}

func insertHomeConfig(jsPath string, flags Flag) {
	if !flags.HomeConfig {
		return
	}

	utils.ModifyFile(jsPath, func(content string) string {
		utils.ReplaceOnce(
			&content,
			`(createDesktopHomeFeatureActivationShelfEventFactory.*?)([\w\.]+)(\.map)`,
			func(submatches ...string) string {
				return fmt.Sprintf("%sSpicetifyHomeConfig.arrange(%s)%s", submatches[1], submatches[2], submatches[3])
			})

		// >= 1.2.40
		utils.ReplaceOnce(
			&content,
			`(&&"HomeShortsSectionData".*?[\],}])([a-zA-Z])(\}\)?\()`,
			func(submatches ...string) string {
				return fmt.Sprintf("%sSpicetifyHomeConfig.arrange(%s)%s", submatches[1], submatches[2], submatches[3])
			})

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

func insertSidebarConfig(jsPath string, flags Flag) {
	if !flags.SidebarConfig {
		return
	}

	utils.ModifyFile(jsPath, func(content string) string {
		utils.ReplaceOnce(
			&content,
			`return null!=\w+&&\w+\.totalLength(\?\w+\(\)\.createElement\(\w+,\{contextUri:)(\w+)\.uri`,
			func(submatches ...string) string {
				return fmt.Sprintf(`return true%s%s?.uri||""`, submatches[1], submatches[2])
			})

		return content
	})
}

func insertExpFeatures(jsPath string, flags Flag) {
	if !flags.ExpFeatures {
		return
	}

	utils.ModifyFile(jsPath, func(content string) string {
		utils.ReplaceOnce(
			&content,
			`(function \w+\((\w+)\)\{)(\w+ \w+=\w\.name;if\("internal")`,
			func(submatches ...string) string {
				return fmt.Sprintf("%s%s=Spicetify.expFeatureOverride(%s);%s", submatches[1], submatches[2], submatches[2], submatches[3])
			})

		// utils.ReplaceOnce(
		// 	&content,
		// 	`(\w+\.fromJSON)(\s*=\s*function\b[^{]*{[^}]*})`,
		// 	func(submatches ...string) string {
		// 		return fmt.Sprintf("%s=Spicetify.createInternalMap%s", submatches[1], submatches[2])
		// 	})

		utils.ReplaceOnce(
			&content,
			`(([\w$.]+\.fromJSON)\(\w+\)+;)(return ?[\w{}().,]+[\w$]+\.Provider,)(\{value:\{localConfiguration)`,
			func(submatches ...string) string {
				return fmt.Sprintf("%sSpicetify.createInternalMap=%s;%sSpicetify.RemoteConfigResolver=%s", submatches[1], submatches[2], submatches[3], submatches[4])
			})

		return content
	})
}

func insertVersionInfo(jsPath string, flags Flag) {
	utils.ModifyFile(jsPath, func(content string) string {
		utils.ReplaceOnce(
			&content,
			`(\w+(?:\(\))?\.createElement|\([\w$\.,]+\))\([\w\."]+,[\w{}():,]+\.containerVersion\}?\),`,
			func(submatches ...string) string {
				return fmt.Sprintf(`%s%s("details",{children: [
					%s("summary",{children: "Spicetify v" + Spicetify.Config.version}),
					%s("li",{children: "Theme: " + Spicetify.Config.current_theme + (Spicetify.Config.color_scheme && " / ") + Spicetify.Config.color_scheme}),
					%s("li",{children: "Extensions: " + Spicetify.Config.extensions.join(", ")}),
					%s("li",{children: "Custom apps: " + Spicetify.Config.custom_apps.join(", ")}),
					]}),`, submatches[0], submatches[1], submatches[1], submatches[1], submatches[1], submatches[1])
			})
		return content
	})
}
