package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// ClassmapStatus describes how a Spotify version is mapped for customization.
type ClassmapStatus string

const (
	// ClassmapStatusClassic means the version is supported via the classic
	// css-map / preprocess pipeline only.
	ClassmapStatusClassic ClassmapStatus = "classic"
	// ClassmapStatusModular means a nested classmap is available for the
	// modules/hooks pipeline (tailor MAP.* remapping).
	ClassmapStatusModular ClassmapStatus = "modular"
	// ClassmapStatusNone means no mapping story is declared yet.
	ClassmapStatusNone ClassmapStatus = "none"
)

// Classmap is a nested semantic-path -> hashed class name tree, as used by
// @delu/tailor and spicetify/classmaps.
// Leaves must be strings; intermediate nodes are nested objects.
type Classmap map[string]any

// ClassmapInfo is metadata about mapping for one Spotify version.
type ClassmapInfo struct {
	// ClassmapKey is the folder id (e.g. "1020093" for 1.2.93).
	ClassmapKey string `json:"classmap_key,omitempty"`
	// Status is classic | modular | none.
	Status ClassmapStatus `json:"status,omitempty"`
	// Note is optional human context.
	Note string `json:"note,omitempty"`
}

// ValidateClassmapStatus returns an error if status is not a known value.
func ValidateClassmapStatus(status ClassmapStatus) error {
	switch status {
	case ClassmapStatusClassic, ClassmapStatusModular, ClassmapStatusNone, "":
		return nil
	default:
		return fmt.Errorf("invalid classmap status %q (want classic, modular, or none)", status)
	}
}

// LoadClassmap reads a classmap JSON file and validates its shape.
func LoadClassmap(path string) (Classmap, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read classmap at %s: %w", path, err)
	}

	var root any
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, fmt.Errorf("classmap is malformed (%s): %w", path, err)
	}

	obj, ok := root.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("classmap root must be a JSON object (%s)", path)
	}

	cm := Classmap(obj)
	if err := cm.Validate(); err != nil {
		return nil, fmt.Errorf("classmap invalid (%s): %w", path, err)
	}
	return cm, nil
}

// Validate ensures every leaf is a non-empty string and every node is an object or string.
func (c Classmap) Validate() error {
	if len(c) == 0 {
		return fmt.Errorf("classmap is empty")
	}
	// Convert named type so the recursive type switch matches map[string]any.
	return validateClassmapNode(map[string]any(c), "")
}

func validateClassmapNode(node any, path string) error {
	switch v := node.(type) {
	case map[string]any:
		// Empty nested objects are allowed as structural placeholders
		// (historical classmaps use them for regions not yet filled in).
		// Only the root must be non-empty (checked in Validate).
		if len(v) == 0 {
			return nil
		}
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			if strings.TrimSpace(k) == "" {
				return fmt.Errorf("%s contains an empty key", displayPath(path))
			}
			childPath := k
			if path != "" {
				childPath = path + "." + k
			}
			if err := validateClassmapNode(v[k], childPath); err != nil {
				return err
			}
		}
		return nil
	case string:
		if strings.TrimSpace(v) == "" {
			return fmt.Errorf("%s is an empty class name", displayPath(path))
		}
		return nil
	case nil:
		return fmt.Errorf("%s is null (leaves must be class name strings)", displayPath(path))
	default:
		return fmt.Errorf("%s has type %T (want object or string)", displayPath(path), node)
	}
}

func displayPath(path string) string {
	if path == "" {
		return "<root>"
	}
	return path
}

// Resolve walks a dotted path (e.g. "main.playbar.controls.buttons.play")
// and returns the leaf class name.
func (c Classmap) Resolve(dotted string) (string, error) {
	dotted = strings.TrimSpace(dotted)
	if dotted == "" {
		return "", fmt.Errorf("empty classmap path")
	}
	parts := strings.Split(dotted, ".")
	var cur any = map[string]any(c)
	for i, part := range parts {
		obj, ok := cur.(map[string]any)
		if !ok {
			return "", fmt.Errorf("%s is not an object", strings.Join(parts[:i], "."))
		}
		next, exists := obj[part]
		if !exists {
			return "", fmt.Errorf("unknown classmap path %q", strings.Join(parts[:i+1], "."))
		}
		cur = next
	}
	s, ok := cur.(string)
	if !ok {
		return "", fmt.Errorf("%s is not a leaf class name", dotted)
	}
	return s, nil
}

// LeafCount returns the number of string leaves in the classmap.
func (c Classmap) LeafCount() int {
	return countLeaves(map[string]any(c))
}

func countLeaves(node any) int {
	switch v := node.(type) {
	case map[string]any:
		n := 0
		for _, child := range v {
			n += countLeaves(child)
		}
		return n
	case string:
		return 1
	default:
		return 0
	}
}

// ClassmapSearchDirs returns directories that may contain per-version classmap folders.
// Order: next to the binary, then the Spicetify config folder.
func ClassmapSearchDirs() []string {
	dirs := []string{
		filepath.Join(GetExecutableDir(), "classmaps"),
		filepath.Join(GetSpicetifyFolder(), "classmaps"),
	}
	// Dedup while preserving order.
	seen := map[string]bool{}
	out := make([]string, 0, len(dirs))
	for _, d := range dirs {
		if d == "" || seen[d] {
			continue
		}
		seen[d] = true
		out = append(out, d)
	}
	return out
}

// FindClassmapFile looks for a classmap JSON for the given classmap key
// under ClassmapSearchDirs().
func FindClassmapFile(classmapKey string) (string, error) {
	return FindClassmapFileIn(classmapKey, ClassmapSearchDirs())
}

// FindClassmapFileIn searches the given roots in order and returns the best
// classmap for the key. The first root that contains the key wins, so
// documented precedence (binary dir, then config dir) is honored instead of
// being decided by file-name sorting. Within one root:
//
//	classmaps/<key>/classmap.json      (preferred)
//	classmaps/<key>/classmap-*.json    (lexicographically last wins)
func FindClassmapFileIn(classmapKey string, roots []string) (string, error) {
	if strings.TrimSpace(classmapKey) == "" {
		return "", fmt.Errorf("empty classmap key")
	}

	for _, root := range roots {
		if best := bestClassmapInRoot(root, classmapKey); best != "" {
			return best, nil
		}
	}

	return "", fmt.Errorf("no classmap found for key %s (searched %s)", classmapKey, strings.Join(roots, ", "))
}

// bestClassmapInRoot returns the preferred classmap file for key under one
// root, or "" when the root has none.
func bestClassmapInRoot(root, classmapKey string) string {
	dir := filepath.Join(root, classmapKey)
	info, err := os.Stat(dir)
	if err != nil || !info.IsDir() {
		return ""
	}

	direct := filepath.Join(dir, "classmap.json")
	if st, err := os.Stat(direct); err == nil && !st.IsDir() {
		return direct
	}

	matches, _ := filepath.Glob(filepath.Join(dir, "classmap-*.json"))
	if len(matches) == 0 {
		return ""
	}
	sort.Strings(matches)
	return matches[len(matches)-1]
}

// LoadClassmapForKey finds and loads a classmap for the key.
func LoadClassmapForKey(classmapKey string) (Classmap, string, error) {
	path, err := FindClassmapFile(classmapKey)
	if err != nil {
		return nil, "", err
	}
	cm, err := LoadClassmap(path)
	if err != nil {
		return nil, path, err
	}
	return cm, path, nil
}

// CssMapOverlayFileName is the flat hash -> semantic overlay generated from a
// classmap (scripts/classmap_capture.py flatten), stored next to it.
const CssMapOverlayFileName = "css-map.json"

// FindCssMapOverlayIn searches roots in order for classmaps/<key>/css-map.json.
func FindCssMapOverlayIn(classmapKey string, roots []string) (string, error) {
	if strings.TrimSpace(classmapKey) == "" {
		return "", fmt.Errorf("empty classmap key")
	}
	for _, root := range roots {
		p := filepath.Join(root, classmapKey, CssMapOverlayFileName)
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return p, nil
		}
	}
	return "", fmt.Errorf("no css-map overlay found for key %s (searched %s)", classmapKey, strings.Join(roots, ", "))
}

// FindCssMapOverlay looks for a css-map overlay under ClassmapSearchDirs().
func FindCssMapOverlay(classmapKey string) (string, error) {
	return FindCssMapOverlayIn(classmapKey, ClassmapSearchDirs())
}

// LoadCssMapOverlay reads a flat hash -> semantic name overlay and validates
// that it is a plain string map (no nested classmap structure).
func LoadCssMapOverlay(path string) (map[string]string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read css-map overlay at %s: %w", path, err)
	}
	var overlay map[string]string
	if err := json.Unmarshal(raw, &overlay); err != nil {
		return nil, fmt.Errorf("css-map overlay is malformed (%s): %w", path, err)
	}
	for k, v := range overlay {
		if strings.TrimSpace(k) == "" || strings.TrimSpace(v) == "" {
			return nil, fmt.Errorf("css-map overlay has an empty key or value (%s)", path)
		}
	}
	return overlay, nil
}
