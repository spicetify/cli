package utils

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// ClassmapRefPattern matches MAP.a.b.c style references in module sources,
// as used by @delu/tailor-built modules (see spicetify/modules stdlib).
var ClassmapRefPattern = regexp.MustCompile(`\bMAP((?:\.[A-Za-z_][A-Za-z0-9_]*)+)`)

// RemapOptions configures the classmap remap.
type RemapOptions struct {
	// StalePaths are classmap paths whose leaves are known to be outdated
	// (from META.json stale_leaves). Resolving one is an error: shipping a
	// module with a stale hash is worse than failing loudly.
	StalePaths map[string]bool
}

// RemapClassmapReferences rewrites MAP.* references in a module source to
// quoted class-name literals resolved from the classmap (the offline
// equivalent of tailor's build-time remap). Any reference that does not
// resolve to a leaf makes the whole remap fail.
func RemapClassmapReferences(src string, cm Classmap) (string, error) {
	return RemapClassmapReferencesWithOptions(src, cm, RemapOptions{})
}

// RemapClassmapReferencesWithOptions is RemapClassmapReferences with options.
func RemapClassmapReferencesWithOptions(src string, cm Classmap, opts RemapOptions) (string, error) {
	unresolved := map[string]bool{}
	stale := map[string]bool{}

	out := ClassmapRefPattern.ReplaceAllStringFunc(src, func(match string) string {
		dotted := strings.TrimPrefix(match, "MAP.")
		if opts.StalePaths[dotted] {
			stale[dotted] = true
			return match
		}
		leaf, err := cm.Resolve(dotted)
		if err != nil {
			unresolved[dotted] = true
			return match
		}
		return strconv.Quote(leaf)
	})

	if len(unresolved)+len(stale) == 0 {
		return out, nil
	}
	var parts []string
	if len(unresolved) > 0 {
		parts = append(parts, "unresolved: "+joinSorted(unresolved))
	}
	if len(stale) > 0 {
		parts = append(parts, "stale: "+joinSorted(stale))
	}
	return "", fmt.Errorf("classmap references failed (%s)", strings.Join(parts, "; "))
}

func joinSorted(set map[string]bool) string {
	items := make([]string, 0, len(set))
	for item := range set {
		items = append(items, item)
	}
	sort.Strings(items)
	return strings.Join(items, ", ")
}
