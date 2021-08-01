package cmd

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/khanhas/spicetify-cli/src/utils"
)

func Patch() {
	keys := patchSection.Keys()

	re := regexp.MustCompile(`^([\w\d\-\.]+)_find_(\d+)$`)
	for _, key := range keys {
		keyName := key.Name()
		matches := re.FindStringSubmatch(keyName)
		if len(matches) == 0 {
			continue
		}

		name := matches[1]
		assetPath := filepath.Join(appPath, "xpui", name)
		index := matches[2]

		if _, err := os.Stat(assetPath); err != nil {
			utils.PrintError("File name \"" + name + "\" is not found.")
			continue
		}

		replName := name + "_repl_all_" + index
		replOnceName := name + "_repl_" + index
		replKey, errAll := patchSection.GetKey(replName)
		replOnceKey, errOnce := patchSection.GetKey(replOnceName)

		if errAll != nil && errOnce != nil {
			utils.PrintError("Cannot find replace string for patch \"" + keyName + "\"")
			utils.PrintInfo("Correct key name for replace string are")
			utils.PrintInfo("    \"" + replOnceName + "\"")
			utils.PrintInfo("    \"" + replName + "\"")
			continue
		}

		patchRegexp, errReg := regexp.Compile(key.String())
		if errReg != nil {
			utils.PrintError("Cannot compile find RegExp for patch \"" + keyName + "\"")
			continue
		}

		utils.ModifyFile(assetPath, func(content string) string {
			if errAll == nil { // Prioritize replace all
				return patchRegexp.ReplaceAllString(content, replKey.MustString(""))
			} else {
				match := patchRegexp.FindString(content)
				if len(match) > 0 {
					toReplace := patchRegexp.ReplaceAllString(match, replOnceKey.MustString(""))
					content = strings.Replace(content, match, toReplace, 1)
				}
				return content
			}
		})

		utils.PrintSuccess("\"" + keyName + "\" is patched")
	}
}
