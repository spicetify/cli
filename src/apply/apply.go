package apply

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

	"github.com/khanhas/spicetify-cli/src/utils"
)

// Flag enables/disables additional feature
type Flag struct {
	Extension            []string
	CustomApp            []string
}

// AdditionalOptions .
func AdditionalOptions(appsFolderPath string, flags Flag) {
	filesToModified := map[string]func(path string, flags Flag){
		filepath.Join(appsFolderPath, "xpui", "index.html"):        htmlMod,
	}

	for file, call := range filesToModified {
		if _, err := os.Stat(file); os.IsNotExist(err) {
			continue
		}

		call(file, flags)
	}
}

// UserCSS creates user.css file in "zlink", "login" and "settings" apps.
// To not use custom css, set `themeFolder` to blank string
// To use default color scheme, set `scheme` to `nil`
func UserCSS(appsFolderPath, themeFolder string, scheme map[string]string) {
	css := []byte(getColorCSS(scheme) + getUserCSS(themeFolder))

	dest := filepath.Join(appsFolderPath, "xpui", "user.css")
	if err := ioutil.WriteFile(dest, css, 0700); err != nil {
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

func htmlMod(htmlPath string, flags Flag) {
	if len(flags.Extension) == 0 {
		return
	}

	extensionsHTML := ""

	for _, v := range flags.Extension {
		if strings.HasSuffix(v, ".mjs") {
			extensionsHTML += `<script type="module" src="` + v + `"></script>` + "\n"
		} else {
			extensionsHTML += `<script src="` + v + `"></script>` + "\n"
		}
	}

	utils.ModifyFile(htmlPath, func(content string) string {
		utils.Replace(
			&content,
			`</body>`,
			extensionsHTML+"${0}",
		)
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

	content, err := ioutil.ReadFile(cssFilePath)
	if err != nil {
		return ""
	}

	return string(content)
}

func getColorCSS(scheme map[string]string) string {
	var variableList string
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
		variableList += fmt.Sprintf(`
    --modspotify_%s: #%s;
    --modspotify_rgb_%s: %s;`,
			k, parsed.Hex(),
			k, parsed.RGB())
	}

	return fmt.Sprintf(":root {%s\n}\n", variableList)
}

func insertCustomApp(zlinkContent *string, appList []string) {

}

func getAssetsPath(themeFolder string) string {
	dir := filepath.Join(themeFolder, "assets")

	if _, err := os.Stat(dir); err != nil {
		return ""
	}

	return dir
}
