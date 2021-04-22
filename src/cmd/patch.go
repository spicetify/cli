package cmd

import (
	"os"
	"path/filepath"
	"regexp"

	"github.com/khanhas/spicetify-cli/src/utils"
)

func Patch() {
	keys := patchSection.Keys()

	re := regexp.MustCompile(`([\w\-]+)_find_(\d+)`)
	for _, key := range keys {
		keyName := key.Name()
		matches := re.FindStringSubmatch(keyName)
		if len(matches) == 0 {
			continue
		}

		name := matches[1]
		pathToApp := filepath.Join(appPath, name)
		index := matches[2]

		if _, err := os.Stat(pathToApp); err != nil {
			utils.PrintError("App name \"" + name + "\" is not valid.")
			continue
		}

		replName := name + "_repl_" + index
		replKey, err := patchSection.GetKey(replName)
		if err != nil {
			utils.PrintError("Cannot find replace string for patch \"" + keyName + "\"")
			utils.PrintInfo("Correct key name for replace string is \"" + replName + "\"")
			continue
		}

		patchRegexp, err := regexp.Compile(key.String())
		if err != nil {
			utils.PrintError("Cannot compile find RegExp for patch \"" + keyName + "\"")
			continue
		}

		jsFilePath := filepath.Join(pathToApp, name+".bundle.js")
		if _, err := os.Stat(jsFilePath); err != nil {
			utils.PrintError("App javascript file \"" + jsFilePath + "\" not found.")
			continue
		}

		utils.ModifyFile(jsFilePath, func(content string) string {
			return patchRegexp.ReplaceAllString(content, replKey.MustString(""))
		})

		utils.PrintSuccess("\"" + keyName + "\" is patched")
	}
}
