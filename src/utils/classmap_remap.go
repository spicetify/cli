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

// HashIndex maps class-name hashes to their dotted path in a classmap.
func HashIndex(cm Classmap) map[string]string {
	index := map[string]string{}
	var walk func(node map[string]any, path []string)
	walk = func(node map[string]any, path []string) {
		for k, v := range node {
			switch child := v.(type) {
			case map[string]any:
				walk(child, append(path, k))
			case string:
				index[child] = strings.Join(append(path, k), ".")
			}
		}
	}
	walk(map[string]any(cm), nil)
	return index
}

// RetargetClassmapHashes rewrites a module source built against one classmap
// (from) so it works with another (to): every leaf hash of `from` present in
// the source is replaced by the leaf at the same path in `to`. This lets
// pre-tailored module artifacts (e.g. releases built for an older classmap)
// be re-aimed offline at the installed Spotify version. A hash with no leaf
// at the same path in `to`, or a path marked stale in `to`, fails the whole
// retarget.
func RetargetClassmapHashes(src string, from, to Classmap, stale map[string]bool) (string, error) {
	return retargetClassmapHashes(src, from, to, stale, false)
}

// RetargetClassmapHashesLenient is RetargetClassmapHashes with per-path
// leniency: stale paths keep their old hash instead of failing (the element
// simply will not match anything on versions where the class is gone).
func RetargetClassmapHashesLenient(src string, from, to Classmap, stale map[string]bool) (string, error) {
	return retargetClassmapHashes(src, from, to, stale, true)
}

func retargetClassmapHashes(src string, from, to Classmap, stale map[string]bool, lenient bool) (string, error) {
	fromIndex := HashIndex(from)
	type replacement struct {
		old, new string
	}
	var replacements []replacement
	missing := map[string]bool{}
	staleHit := map[string]bool{}

	for hash, path := range fromIndex {
		if !strings.Contains(src, hash) {
			continue
		}
		newHash, err := to.Resolve(path)
		if err != nil {
			missing[path] = true
			continue
		}
		if stale[path] {
			if lenient {
				continue
			}
			staleHit[path] = true
			continue
		}
		if newHash != hash {
			replacements = append(replacements, replacement{old: hash, new: newHash})
		}
	}

	if len(missing)+len(staleHit) > 0 {
		var parts []string
		if len(missing) > 0 {
			parts = append(parts, "missing in target: "+joinSorted(missing))
		}
		if len(staleHit) > 0 {
			parts = append(parts, "stale: "+joinSorted(staleHit))
		}
		return "", fmt.Errorf("classmap retarget failed (%s)", strings.Join(parts, "; "))
	}

	// Longest first so overlapping hashes can't partially match.
	sort.Slice(replacements, func(i, j int) bool {
		return len(replacements[i].old) > len(replacements[j].old)
	})
	out := src
	for _, r := range replacements {
		out = strings.ReplaceAll(out, r.old, r.new)
	}
	return out, nil
}
