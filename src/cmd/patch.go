package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"

	"github.com/spicetify/cli/src/utils"
)

type patchTask struct {
	keyName string
	pattern string
	index   string
}

type filePatchGroup struct {
	name  string
	tasks []patchTask
}

type compiledPatch struct {
	keyName    string
	regexp     *regexp.Regexp
	replStr    string
	replaceAll bool
}

type patchResult struct {
	keyName    string
	replaceAll bool
	matchCount int
	changed    bool
}

func applyPatches(content string, patches []compiledPatch) (string, []patchResult) {
	results := make([]patchResult, 0, len(patches))

	for _, p := range patches {
		res := patchResult{
			keyName:    p.keyName,
			replaceAll: p.replaceAll,
		}

		if p.replaceAll {
			locs := p.regexp.FindAllStringSubmatchIndex(content, -1)
			res.matchCount = len(locs)
			if len(locs) > 0 {
				var dst []byte
				lastIndex := 0
				for _, loc := range locs {
					dst = append(dst, content[lastIndex:loc[0]]...)
					dst = p.regexp.ExpandString(dst, p.replStr, content, loc)
					lastIndex = loc[1]
				}
				dst = append(dst, content[lastIndex:]...)
				newContent := string(dst)
				res.changed = newContent != content
				content = newContent
			}
		} else {
			loc := p.regexp.FindStringSubmatchIndex(content)
			if loc != nil && loc[0] < loc[1] {
				res.matchCount = 1
				repl := p.regexp.ExpandString(nil, p.replStr, content, loc)
				newContent := content[:loc[0]] + string(repl) + content[loc[1]:]
				res.changed = newContent != content
				content = newContent
			}
		}

		results = append(results, res)
	}

	return content, results
}

func Patch() {
	utils.PrintBold("Applying custom patches:")
	keys := patchSection.Keys()

	var groups []*filePatchGroup
	groupMap := make(map[string]*filePatchGroup)
	seenFind := make(map[string]bool)

	reFind := regexp.MustCompile(`^([\w\d\-~\.]+)_find_(\d+)$`)
	reRepl := regexp.MustCompile(`^([\w\d\-~\.]+)_repl_(?:all_)?(\d+)$`)

	for _, key := range keys {
		keyName := key.Name()
		matches := reFind.FindStringSubmatch(keyName)
		if len(matches) == 0 {
			continue
		}

		name := matches[1]
		index := matches[2]
		seenFind[name+"_find_"+index] = true

		group, exists := groupMap[name]
		if !exists {
			group = &filePatchGroup{name: name}
			groupMap[name] = group
			groups = append(groups, group)
		}

		group.tasks = append(group.tasks, patchTask{
			keyName: keyName,
			pattern: key.String(),
			index:   index,
		})
	}

	for _, key := range keys {
		keyName := key.Name()
		matches := reRepl.FindStringSubmatch(keyName)
		if len(matches) == 0 {
			continue
		}

		findKeyName := matches[1] + "_find_" + matches[2]
		if !seenFind[findKeyName] {
			utils.PrintWarning("Orphan replace key \"" + keyName + "\" (missing \"" + findKeyName + "\")")
		}
	}

	for _, group := range groups {
		assetPath := filepath.Join(appDestPath, "xpui", group.name)

		fileInfo, err := os.Stat(assetPath)
		if err != nil || fileInfo.IsDir() {
			utils.PrintError("File name \"" + group.name + "\" is not found.")
			continue
		}

		var patches []compiledPatch
		for _, task := range group.tasks {
			replName := group.name + "_repl_all_" + task.index
			replOnceName := group.name + "_repl_" + task.index
			replKey, errAll := patchSection.GetKey(replName)
			replOnceKey, errOnce := patchSection.GetKey(replOnceName)

			if errAll != nil && errOnce != nil {
				utils.PrintError("Cannot find replace string for patch \"" + task.keyName + "\"")
				utils.PrintInfo("Correct key name for replace string are:")
				utils.PrintInfo("    \"" + replOnceName + "\"")
				utils.PrintInfo("    \"" + replName + "\"")
				continue
			}

			patchRegexp, errReg := regexp.Compile(task.pattern)
			if errReg != nil {
				utils.PrintError("Cannot compile find RegExp for patch \"" + task.keyName + "\"")
				continue
			}

			// Prioritize replace all
			if errAll == nil {
				patches = append(patches, compiledPatch{
					keyName:    task.keyName,
					regexp:     patchRegexp,
					replStr:    replKey.MustString(""),
					replaceAll: true,
				})
			} else {
				patches = append(patches, compiledPatch{
					keyName:    task.keyName,
					regexp:     patchRegexp,
					replStr:    replOnceKey.MustString(""),
					replaceAll: false,
				})
			}
		}

		if len(patches) == 0 {
			continue
		}

		raw, err := os.ReadFile(assetPath)
		if err != nil {
			utils.PrintError("Cannot read file \"" + group.name + "\": " + err.Error())
			continue
		}

		content := string(raw)
		newContent, results := applyPatches(content, patches)

		if newContent != content {
			if err := os.WriteFile(assetPath, []byte(newContent), fileInfo.Mode()); err != nil {
				utils.PrintError("Cannot write file \"" + group.name + "\": " + err.Error())
				continue
			}
		}

		for _, res := range results {
			if res.matchCount == 0 {
				utils.PrintWarning("Pattern not found for patch \"" + res.keyName + "\"")
			} else if !res.changed {
				utils.PrintInfo("\"" + res.keyName + "\" matched (content unchanged)")
			} else if res.replaceAll {
				utils.PrintSuccess(fmt.Sprintf("\"%s\" is patched (%d matched)", res.keyName, res.matchCount))
			} else {
				utils.PrintSuccess("\"" + res.keyName + "\" is patched")
			}
		}

	}

	utils.PrintSuccess("Applied custom patches")
}
