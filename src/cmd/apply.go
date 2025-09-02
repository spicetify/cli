package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spicetify/cli/src/apply"
	backupstatus "github.com/spicetify/cli/src/status/backup"
	spotifystatus "github.com/spicetify/cli/src/status/spotify"
	"github.com/spicetify/cli/src/utils"
)

// Apply .
func Apply(spicetifyVersion string) {
	utils.MigrateConfigFolder()

	backupSpicetifyVersion := backupSection.Key("with").MustString("")
	if spicetifyVersion != backupSpicetifyVersion {
		utils.PrintInfo(`Preprocessed Spotify data is outdated. Please run "spicetify restore backup apply" to receive new features and bug fixes`)
		os.Exit(1)
	}

	// Copy raw assets to Spotify Apps folder if Spotify is never applied
	// before.
	// extractedStock is for preventing copy raw assets 2 times when
	// replaceColors is false.
	extractedStock := false
	if !spotifystatus.Get(appDestPath).IsApplied() {
		spinner, _ := utils.Spinner.Start("Copying raw assets")
		if err := os.RemoveAll(appDestPath); err != nil {
			spinner.Fail("Failed to copy raw assets")
			utils.Fatal(err)
		}
		if err := utils.Copy(rawFolder, appDestPath, true, nil); err != nil {
			spinner.Fail("Failed to copy raw assets")
			utils.Fatal(err)
		}
		spinner.Success("Copied raw assets")
		extractedStock = true
	}

	if replaceColors {
		spinner, _ := utils.Spinner.Start("Overwriting themed assets")
		if err := utils.Copy(themedFolder, appDestPath, true, nil); err != nil {
			spinner.Fail("Failed to overwrite themed assets")
			utils.Fatal(err)
		}
		spinner.Success("Overwrote themed assets")
	} else if !extractedStock {
		spinner, _ := utils.Spinner.Start("Overwriting raw assets")
		if err := utils.Copy(rawFolder, appDestPath, true, nil); err != nil {
			spinner.Fail("Failed to overwrite raw assets")
			utils.Fatal(err)
		}
		spinner.Success("Overwrote raw assets")
	}

	RefreshTheme()

	if preprocSection.Key("expose_apis").MustBool(false) {
		utils.CopyFile(
			filepath.Join(utils.GetJsHelperDir(), "spicetifyWrapper.js"),
			filepath.Join(appDestPath, "xpui", "helper"))
	}

	extensionList := featureSection.Key("extensions").Strings("|")
	customAppsList := featureSection.Key("custom_apps").Strings("|")

	spinner, _ := utils.Spinner.Start("Applying additional modifications")
	apply.AdditionalOptions(appDestPath, apply.Flag{
		CurrentTheme:         settingSection.Key("current_theme").MustString(""),
		ColorScheme:          settingSection.Key("color_scheme").MustString(""),
		InjectThemeJS:        injectJS,
		CheckSpicetifyUpdate: settingSection.Key("check_spicetify_update").MustBool(false),
		Extension:            extensionList,
		CustomApp:            customAppsList,
		SidebarConfig:        featureSection.Key("sidebar_config").MustBool(false),
		HomeConfig:           featureSection.Key("home_config").MustBool(false),
		ExpFeatures:          featureSection.Key("experimental_features").MustBool(false),
		SpicetifyVer:         backupSection.Key("with").MustString(""),
	})
	spinner.Success("Applied additional modifications")

	if len(extensionList) > 0 {
		RefreshExtensions(extensionList...)
		nodeModuleSymlink()
	}

	if len(customAppsList) > 0 {
		RefreshApps(customAppsList...)
	}

	if len(patchSection.Keys()) > 0 {
		Patch()
	}
}

// RefreshTheme updates user.css + theme.js and overwrites custom assets
func RefreshTheme() {
	refreshThemeCSS()

	if injectJS {
		refreshThemeJS()
	} else {
		utils.CheckExistAndDelete(filepath.Join(appDestPath, "xpui", "extensions/theme.js"))
	}

	if overwriteAssets {
		refreshThemeAssets()
	}
}

type spicetifyConfigJson struct {
	ThemeName  string                       `json:"theme_name"`
	SchemeName string                       `json:"scheme_name"`
	Schemes    map[string]map[string]string `json:"schemes"`
}

func refreshThemeCSS() {
	spinner, _ := utils.Spinner.Start("Updating theme's styles")
	var scheme map[string]string = nil
	if colorSection != nil {
		scheme = colorSection.KeysHash()
	}
	theme := themeFolder
	if !injectCSS {
		theme = ""
	}
	apply.UserCSS(appDestPath, theme, scheme)

	var configJson spicetifyConfigJson
	configJson.ThemeName = settingSection.Key("current_theme").MustString("")
	configJson.SchemeName = settingSection.Key("color_scheme").MustString("")

	if colorCfg != nil {
		colorsJson := make(map[string]map[string]string)
		for _, section := range colorCfg.Sections() {
			name := section.Name()
			colorsJson[name] = make(map[string]string)

			for _, key := range section.Keys() {
				colorsJson[name][key.Name()] = key.MustString("")
			}
		}
		configJson.Schemes = colorsJson
	}

	configJsonBytes, err := json.MarshalIndent(configJson, "", "    ")
	if err != nil {
		spinner.Fail("Failed to update theme's styles")
		utils.PrintError("Cannot convert colors.ini to JSON")
	} else {
		if err := os.WriteFile(
			filepath.Join(appDestPath, "xpui", "spicetify-config.json"),
			configJsonBytes, 0700); err != nil {
			spinner.Fail("Failed to update theme's styles")
			utils.PrintError(err.Error())
		} else {
			spinner.Success("Updated theme's styles")
		}
	}
}

func refreshThemeAssets() {
	spinner, _ := utils.Spinner.Start("Updating custom assets")
	apply.UserAsset(appDestPath, themeFolder)
	spinner.Success("Updated custom assets")
}

// RefreshExtensions pushes all extensions to Spotify
func RefreshExtensions(list ...string) {
	spinner, _ := utils.Spinner.Start("Refreshing extensions")
	if len(list) == 0 {
		list = featureSection.Key("extensions").Strings("|")
	}

	if len(list) > 0 {
		pushExtensions("", list...)
		spinner.Success("Refreshed extensions")
	} else {
		spinner.Info("No extensions to update")
	}
}

// CheckStates examines both Backup and Spotify states to prompt informative
// instruction for users
func CheckStates() {
	backupVersion := backupSection.Key("version").MustString("")
	backStat := backupstatus.Get(prefsPath, backupFolder, backupVersion)
	spotStat := spotifystatus.Get(appPath)

	if backStat.IsEmpty() {
		if spotStat.IsBackupable() {
			utils.PrintError(`You haven't backed up. Run "spicetify backup apply"`)
		} else {
			utils.PrintError(`You haven't backed up and Spotify cannot be backed up at this state. Please re-install Spotify then run "spicetify backup apply"`)
		}
		os.Exit(1)

	} else if backStat.IsOutdated() {
		utils.PrintWarning("Spotify version and backup version are mismatched.")

		if spotStat.IsMixed() {
			utils.PrintInfo(`Spotify client possibly just had a new update`)
			utils.PrintInfo(`Please run "spicetify backup apply"`)
		} else if spotStat.IsStock() {
			utils.PrintInfo(`Spotify client is in stock state`)
			utils.PrintInfo(`Please run "spicetify backup apply"`)
		} else {
			utils.PrintInfo(`Spotify cannot be backed up at this state. Please re-install Spotify then run "spicetify backup apply"`)
		}

		os.Exit(1)
	}
}

func refreshThemeJS() {
	spinner, _ := utils.Spinner.Start("Updating theme's script")
	if err := utils.CopyFile(
		filepath.Join(themeFolder, "theme.js"),
		filepath.Join(appDestPath, "xpui", "extensions")); err != nil {
		spinner.Fail("Failed to update theme's script")
		utils.PrintError(err.Error())
	} else {
		spinner.Success("Updated theme's script")
	}
}

func pushExtensions(destExt string, list ...string) {
	var err error
	var dest string
	if len(destExt) > 0 {
		dest = filepath.Join(appDestPath, "xpui", "extensions", destExt)
	} else {
		dest = filepath.Join(appDestPath, "xpui", "extensions")
	}

	for _, v := range list {
		var extName, extPath string

		if filepath.IsAbs(v) {
			extName = filepath.Base(v)
			extPath = v
		} else {
			extName = v
			if !strings.Contains(extName, ".js") && !strings.Contains(extName, ".mjs") {
				extName += ".js"
			}
			extPath, err = utils.GetExtensionPath(extName)
			if err != nil {
				utils.PrintError(`Extension "` + extName + `" not found`)
				continue
			}
		}

		if err = utils.CopyFile(extPath, dest); err != nil {
			utils.PrintError(err.Error())
			continue
		}

		if strings.HasSuffix(extName, ".mjs") {
			utils.ModifyFile(filepath.Join(dest, extName), func(content string) string {
				lines := strings.Split(content, "\n")
				for i := 0; i < len(lines); i++ {
					mapping := utils.FindSymbol("", lines[i], []string{
						`//\s*spicetify_map\{(.+?)\}\{(.+?)\}`,
					})
					if len(mapping) > 0 {
						lines[i+1] = strings.Replace(lines[i+1], mapping[0], mapping[1], 1)
					}
				}

				return strings.Join(lines, "\n")
			})
		}
	}
}

func RefreshApps(list ...string) {
	spinner, _ := utils.Spinner.Start("Refreshing custom apps")
	if len(list) == 0 {
		list = featureSection.Key("custom_apps").Strings("|")
	}

	for _, app := range list {
		appName := `spicetify-routes-` + app

		customAppPath, err := utils.GetCustomAppPath(app)
		if err != nil {
			utils.PrintError(`Custom app "` + app + `" not found`)
			continue
		}

		jsFile := filepath.Join(customAppPath, "index.js")
		jsFileContent, err := os.ReadFile(jsFile)
		if err != nil {
			utils.PrintError(`Custom app "` + app + `" does not have index.js`)
			continue
		}

		manifestFile := filepath.Join(customAppPath, "manifest.json")
		manifestFileContent, err := os.ReadFile(manifestFile)
		if err != nil {
			manifestFileContent = []byte{'{', '}'}
		}
		os.WriteFile(
			filepath.Join(appDestPath, "xpui", appName+".json"),
			manifestFileContent,
			0700)

		var manifestJson utils.AppManifest
		if err = json.Unmarshal(manifestFileContent, &manifestJson); err == nil {
			for _, subfile := range manifestJson.Files {
				subfilePath := filepath.Join(customAppPath, subfile)
				subfileContent, err := os.ReadFile(subfilePath)
				if err != nil {
					continue
				}
				jsFileContent = append(jsFileContent, '\n')
				jsFileContent = append(jsFileContent, subfileContent...)
			}
			for _, extensionFile := range manifestJson.ExtensionFiles {
				subfilePath, err := filepath.Abs(filepath.Join(customAppPath, extensionFile))
				if err != nil {
					continue
				}
				pushExtensions(app, subfilePath)
			}
			for _, assetExpr := range manifestJson.Assets {
				assetsList, err := filepath.Glob(filepath.Join(customAppPath, assetExpr))
				if err != nil {
					utils.PrintError(err.Error())
					continue
				}
				if len(assetsList) == 0 {
					message := fmt.Sprintf("Custom App '%s': no assets found for expression '%s'", app, assetExpr)
					utils.PrintWarning(message)
					continue
				}
				for _, assetPath := range assetsList {
					assetName, err := filepath.Rel(customAppPath, assetPath)
					if err != nil {
						utils.PrintError(err.Error())
						continue
					}
					stat, err := os.Stat(assetPath)
					if err != nil {
						utils.PrintError(err.Error())
						continue
					}
					if stat.IsDir() {
						dest := filepath.Join(appDestPath, "xpui", "assets", app, assetName)
						err = utils.Copy(assetPath, dest, true, []string{})
					} else {
						dest := filepath.Join(appDestPath, "xpui", "assets", app, filepath.Dir(assetName))
						err = utils.CopyFile(assetPath, dest)
					}
					if err != nil {
						utils.PrintError(err.Error())
						continue
					}
				}
			}
		}

		jsTemplate := fmt.Sprintf(
			`(("undefined"!=typeof self?self:global).webpackChunkclient_web=("undefined"!=typeof self?self:global).webpackChunkclient_web||[])
.push([["%s"],{"%s":(e,t,n)=>{
"use strict";n.r(t),n.d(t,{default:()=>render});
%s
}}]);`,
			appName, appName, jsFileContent)

		os.WriteFile(
			filepath.Join(appDestPath, "xpui", appName+".js"),
			[]byte(jsTemplate),
			0700)

		cssFile := filepath.Join(customAppPath, "style.css")
		cssFileContent, err := os.ReadFile(cssFile)
		if err != nil {
			cssFileContent = []byte{}
		}
		os.WriteFile(
			filepath.Join(appDestPath, "xpui", appName+".css"),
			[]byte(cssFileContent),
			0700)
	}

	spinner.Success("Refreshed custom apps")
}

func nodeModuleSymlink() {
	nodeModulePath, err := utils.GetExtensionPath("node_modules")
	if err != nil {
		return
	}

	spinner, _ := utils.Spinner.Start("Creating node_modules symlink")

	nodeModuleDest := filepath.Join(appDestPath, "xpui", "extensions", "node_modules")
	if err = utils.CreateJunction(nodeModulePath, nodeModuleDest); err != nil {
		spinner.Fail("Failed to create node_modules symlink")
		utils.PrintError(err.Error())
		return
	}

	spinner.Success("Created node_modules symlink")
}
