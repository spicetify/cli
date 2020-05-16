package cmd

import (
	"errors"
	"os"
	"path/filepath"

	"github.com/go-ini/ini"
	"github.com/khanhas/spicetify-cli/src/apply"
	backupstatus "github.com/khanhas/spicetify-cli/src/status/backup"
	spotifystatus "github.com/khanhas/spicetify-cli/src/status/spotify"
	"github.com/khanhas/spicetify-cli/src/utils"
)

// Apply .
func Apply() {
	checkStates()
	InitSetting()

	// Copy raw assets to Spotify Apps folder if Spotify is never applied
	// before.
	// extractedStock is for preventing copy raw assets 2 times when
	// replaceColors is false.
	extractedStock := false
	if !spotifystatus.Get(spotifyPath).IsApplied() {
		utils.PrintBold(`Copying raw assets:`)
		if err := os.RemoveAll(appPath); err != nil {
			utils.Fatal(err)
		}
		if err := utils.Copy(rawFolder, appPath, true, nil); err != nil {
			utils.Fatal(err)
		}
		utils.PrintGreen("OK")
		extractedStock = true
	}

	if replaceColors {
		utils.PrintBold(`Overwriting themed assets:`)
		if err := utils.Copy(themedFolder, appPath, true, nil); err != nil {
			utils.Fatal(err)
		}
		utils.PrintGreen("OK")
	} else if !extractedStock {
		utils.PrintBold(`Overwriting raw assets:`)
		if err := utils.Copy(rawFolder, appPath, true, nil); err != nil {
			utils.Fatal(err)
		}
		utils.PrintGreen("OK")
	}

	utils.PrintBold(`Transferring user.css:`)
	apply.UserCSS(
		appPath,
		themeFolder,
		injectCSS,
		replaceColors,
		colorSection,
	)
	utils.PrintGreen("OK")

	if overwriteAssets {
		utils.PrintBold(`Overwriting custom assets:`)
		apply.UserAsset(appPath, themeFolder)
		utils.PrintGreen("OK")
	}

	extentionList := featureSection.Key("extensions").Strings("|")
	customAppsList := featureSection.Key("custom_apps").Strings("|")

	utils.PrintBold(`Applying additional modifications:`)
	apply.AdditionalOptions(appPath, apply.Flag{
		ExperimentalFeatures: toTernary(featureSection, "experimental_features"),
		FastUserSwitching:    toTernary(featureSection, "fastUser_switching"),
		Home:                 toTernary(featureSection, "home"),
		LyricAlwaysShow:      toTernary(featureSection, "lyric_always_show"),
		LyricForceNoSync:     toTernary(featureSection, "lyric_force_no_sync"),
		Radio:                toTernary(featureSection, "radio"),
		SongPage:             toTernary(featureSection, "song_page"),
		VisHighFramerate:     toTernary(featureSection, "visualization_high_framerate"),
		XPUI:                 toTernary(featureSection, "minimal_ui"),
		TasteBuds:            toTernary(featureSection, "tastebuds"),
		Extension:            extentionList,
		CustomApp:            customAppsList,
	})
	utils.PrintGreen("OK")

	if len(extentionList) > 0 {
		utils.PrintBold(`Transferring extensions:`)
		pushExtensions(extentionList...)
		utils.PrintGreen("OK")
		nodeModuleSymlink()
	}

	if len(customAppsList) > 0 {
		utils.PrintBold(`Creating custom apps symlinks:`)
		pushApps(customAppsList...)
		utils.PrintGreen("OK")
	}

	utils.PrintSuccess("Spotify is spiced up!")
}

// UpdateTheme updates user.css and overwrites custom assets
func UpdateTheme() {
	checkStates()
	InitSetting()

	if len(themeFolder) == 0 {
		utils.PrintWarning(`Nothing is updated: Config "current_theme" is blank.`)
		os.Exit(1)
	}

	updateCSS()

	if overwriteAssets {
		updateAssets()
	}
}

func updateCSS() {
	apply.UserCSS(
		appPath,
		themeFolder,
		injectCSS,
		replaceColors,
		colorSection,
	)

	utils.PrintSuccess(utils.PrependTime("Custom CSS is updated"))
}

func updateAssets() {
	apply.UserAsset(appPath, themeFolder)
	utils.PrintSuccess(utils.PrependTime("Custom assets are updated"))
}

// UpdateAllExtension pushs all extensions to Spotify
func UpdateAllExtension() {
	checkStates()
	list := featureSection.Key("extensions").Strings("|")
	if len(list) > 0 {
		pushExtensions(list...)
		utils.PrintSuccess(utils.PrependTime("All extensions are updated."))
	} else {
		utils.PrintError("No extension to update.")
	}
}

// checkStates examines both Backup and Spotify states to promt informative
// instruction for users
func checkStates() {
	backupVersion := backupSection.Key("version").MustString("")
	backStat := backupstatus.Get(prefsPath, backupFolder, backupVersion)
	spotStat := spotifystatus.Get(spotifyPath)

	if backStat.IsEmpty() {
		if spotStat.IsBackupable() {
			utils.PrintError(`You haven't backed up. Run "spicetify backup apply".`)

		} else {
			utils.PrintError(`You haven't backed up and Spotify cannot be backed up at this state. Please re-install Spotify then run "spicetify backup apply".`)
		}
		os.Exit(1)

	} else if backStat.IsOutdated() {
		utils.PrintWarning("Spotify version and backup version are mismatched.")

		if spotStat.IsMixed() {
			utils.PrintInfo(`Spotify client possibly just had an new update.`)
			utils.PrintInfo(`Please run "spicetify backup apply".`)

		} else if spotStat.IsStock() {
			utils.PrintInfo(`Please run "spicetify backup apply".`)

		} else {
			utils.PrintInfo(`Spotify cannot be backed up at this state. Please re-install Spotify then run "spicetify backup apply".`)
		}

		if !ReadAnswer("Continue anyway? [y/N] ", false, true) {
			os.Exit(1)
		}
	}
}

func getExtensionPath(name string) (string, error) {
	extFilePath := filepath.Join(spicetifyFolder, "Extensions", name)

	if _, err := os.Stat(extFilePath); err == nil {
		return extFilePath, nil
	}

	extFilePath = filepath.Join(utils.GetExecutableDir(), "Extensions", name)

	if _, err := os.Stat(extFilePath); err == nil {
		return extFilePath, nil
	}

	return "", errors.New("Extension not found")
}

func pushExtensions(list ...string) {
	zlinkFolder := filepath.Join(spotifyPath, "Apps", "zlink")

	for _, v := range list {
		extPath, err := getExtensionPath(v)
		if err != nil {
			utils.PrintError(`Extension "` + v + `" not found.`)
			continue
		}

		if err = utils.CopyFile(extPath, zlinkFolder); err != nil {
			utils.PrintError(err.Error())
			continue
		}
	}
}

func getCustomAppPath(name string) (string, error) {
	customAppFolderPath := filepath.Join(spicetifyFolder, "CustomApps", name)

	if _, err := os.Stat(customAppFolderPath); err == nil {
		return customAppFolderPath, nil
	}

	customAppFolderPath = filepath.Join(utils.GetExecutableDir(), "CustomApps", name)

	if _, err := os.Stat(customAppFolderPath); err == nil {
		return customAppFolderPath, nil
	}

	return "", errors.New("Custom app not found")
}

func pushApps(list ...string) {
	for _, name := range list {
		customAppPath, err := getCustomAppPath(name)
		if err != nil {
			utils.PrintError(`Custom app "` + name + `" not found.`)
			continue
		}

		customAppDestPath := filepath.Join(appPath, name)

		if err = utils.CreateJunction(customAppPath, customAppDestPath); err != nil {
			utils.Fatal(err)
		}
	}
}

func toTernary(section *ini.Section, key string) utils.TernaryBool {
	return utils.TernaryBool(section.Key(key).MustInt(0))
}

func nodeModuleSymlink() {
	nodeModulePath, err := getExtensionPath("node_modules")
	if err != nil {
		return
	}

	utils.PrintBold(`Found node_modules folder. Creating node_modules symlink:`)

	nodeModuleDest := filepath.Join(spotifyPath, "Apps", "zlink", "node_modules")
	if err = utils.CreateJunction(nodeModulePath, nodeModuleDest); err != nil {
		utils.PrintError("Cannot create node_modules symlink")
		return
	}

	utils.PrintGreen("OK")
}
