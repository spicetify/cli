package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"

	"github.com/spicetify/cli/src/utils"
)

type compiledPatch struct {
	keyName    string
	regexp     *regexp.Regexp
	replStr    string
	replaceAll bool
}

func Patch() {
	utils.PrintBold("Applying custom patches:")
	keys := patchSection.Keys()

	var fileOrder []string
	patchesByFile := make(map[string][]compiledPatch)

	reFind := regexp.MustCompile(`^([\w\d\-~\.]+)_find_(\d+)$`)
	reRepl := regexp.MustCompile(`^([\w\d\-~\.]+)_repl_(?:all_)?(\d+)$`)

	for _, key := range keys {
		keyName := key.Name()
		if matches := reFind.FindStringSubmatch(keyName); len(matches) > 0 {
			name := matches[1]
			index := matches[2]

			replName := name + "_repl_all_" + index
			replOnceName := name + "_repl_" + index
			replKey, errAll := patchSection.GetKey(replName)
			replOnceKey, errOnce := patchSection.GetKey(replOnceName)

			if errAll != nil && errOnce != nil {
				utils.PrintError("Cannot find replace string for patch \"" + keyName + "\"")
				utils.PrintInfo("Correct key name for replace string are:")
				utils.PrintInfo("    \"" + replOnceName + "\"")
				utils.PrintInfo("    \"" + replName + "\"")
				continue
			}

			patchRegexp, errReg := regexp.Compile(key.String())
			if errReg != nil {
				utils.PrintError("Cannot compile find RegExp for patch \"" + keyName + "\"")
				continue
			}

			// Prioritize replace all
			replaceAll := errAll == nil
			if !replaceAll {
				replKey = replOnceKey
			}

			if _, exists := patchesByFile[name]; !exists {
				fileOrder = append(fileOrder, name)
			}
			patchesByFile[name] = append(patchesByFile[name], compiledPatch{
				keyName:    keyName,
				regexp:     patchRegexp,
				replStr:    replKey.MustString(""),
				replaceAll: replaceAll,
			})
		} else if matches := reRepl.FindStringSubmatch(keyName); len(matches) > 0 {
			findKeyName := matches[1] + "_find_" + matches[2]
			if _, err := patchSection.GetKey(findKeyName); err != nil {
				utils.PrintWarning("Orphan replace key \"" + keyName + "\" (missing \"" + findKeyName + "\")")
			}
		}
	}

	for _, name := range fileOrder {
		assetPath := filepath.Join(appDestPath, "xpui", name)

		if fileInfo, err := os.Stat(assetPath); err != nil || fileInfo.IsDir() {
			utils.PrintError("File name \"" + name + "\" is not found.")
			continue
		}

		var patched []string
		err := utils.ModifyFile(assetPath, func(content string) string {
			for _, p := range patchesByFile[name] {
				if p.replaceAll {
					matches := p.regexp.FindAllStringIndex(content, -1)
					if len(matches) == 0 {
						utils.PrintWarning("Pattern not found for patch \"" + p.keyName + "\"")
						continue
					}
					content = p.regexp.ReplaceAllString(content, p.replStr)
					patched = append(patched, fmt.Sprintf("\"%s\" is patched (%d matched)", p.keyName, len(matches)))
				} else {
					loc := p.regexp.FindStringSubmatchIndex(content)
					if loc == nil {
						utils.PrintWarning("Pattern not found for patch \"" + p.keyName + "\"")
						continue
					}
					if loc[0] == loc[1] {
						utils.PrintWarning("Empty match skipped for patch \"" + p.keyName + "\"")
						continue
					}
					repl := p.regexp.ExpandString(nil, p.replStr, content, loc)
					content = content[:loc[0]] + string(repl) + content[loc[1]:]
					patched = append(patched, "\""+p.keyName+"\" is patched")
				}
			}
			return content
		})
		if err != nil {
			continue
		}

		for _, msg := range patched {
			utils.PrintSuccess(msg)
		}
	}

	utils.PrintSuccess("Applied custom patches")
}
