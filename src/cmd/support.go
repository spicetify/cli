package cmd

import (
	"fmt"
	"os"

	"github.com/spicetify/cli/src/utils"
)

// ShowSpotifySupport prints a detailed support + classmap report for the
// installed Spotify client (and optional version argument).
func ShowSpotifySupport(args []string) {
	var raw, source string
	if len(args) > 0 {
		raw = args[0]
		source = "argument"
	} else {
		// InitPaths already ran (or exited) before this command, so
		// spotifyPath/prefsPath are resolved here.
		raw, source = detectSpotifyVersion()
	}

	if raw == "" {
		utils.PrintError("No Spotify version available. Launch Spotify once, or pass a version: spicetify support 1.2.93")
		os.Exit(1)
	}

	report := utils.EvaluateSpotifySupport(raw, "")
	printSupportReport(report, source)
	// Exit non-zero only on a definitive "not allowlisted"; an unavailable
	// list is unknown, not unsupported (matches the gate's fail-open stance).
	if report.ListAvailable && !report.Supported {
		os.Exit(1)
	}
}

func printSupportReport(report utils.SpotifySupportReport, source string) {
	utils.PrintBold("Spotify support")
	fmt.Println("  version (raw):        ", report.RawVersion)
	if report.NormalizedVersion != "" {
		fmt.Println("  version (normalized):", report.NormalizedVersion)
	}
	if source != "" {
		fmt.Println("  version source:       ", source)
	}
	switch {
	case !report.ListAvailable:
		fmt.Println("  allowlisted:          unknown (support list unavailable)")
	case report.Supported:
		fmt.Println("  allowlisted:          yes")
	default:
		fmt.Println("  allowlisted:          no")
	}

	if report.Map.ClassmapKey != "" {
		fmt.Println("  classmap key:         ", report.Map.ClassmapKey)
	}
	if report.Map.Status != "" {
		fmt.Println("  map status:           ", report.Map.Status)
	}
	if report.Map.Note != "" {
		fmt.Println("  map note:             ", report.Map.Note)
	}
	if report.Notes != "" {
		fmt.Println("  release note:         ", report.Notes)
	}

	switch {
	case report.ClassmapPath != "":
		fmt.Println("  classmap file:        ", report.ClassmapPath)
		fmt.Println("  classmap leaves:      ", report.ClassmapLeaves)
	case report.Map.Status == utils.ClassmapStatusModular:
		fmt.Println("  classmap file:         (missing; modular status requires a file)")
		if report.ClassmapError != "" {
			fmt.Println("  classmap lookup:      ", report.ClassmapError)
		}
	case report.Map.Status == utils.ClassmapStatusClassic:
		fmt.Println("  classmap file:         (none; classic css-map pipeline)")
	default:
		if report.ClassmapError != "" {
			fmt.Println("  classmap lookup:      ", report.ClassmapError)
		}
	}

	if report.SupportListPath != "" {
		fmt.Println("  support list:         ", report.SupportListPath)
	}
	if report.SupportListError != "" {
		fmt.Println("  detail:               ", report.SupportListError)
	}

	fmt.Println()
	fmt.Println("  classmap search paths:")
	for _, dir := range utils.ClassmapSearchDirs() {
		fmt.Println("   -", dir)
	}
}
