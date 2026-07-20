package utils

import "fmt"

// SpotifySupportReport is a snapshot of support + classmap state for one install.
type SpotifySupportReport struct {
	RawVersion        string
	NormalizedVersion string
	// ListAvailable is true when a support list was found and parsed.
	// When false, Supported is meaningless and callers should display
	// "unknown" rather than "not allowlisted".
	ListAvailable    bool
	Supported        bool
	Map              ClassmapInfo
	ClassmapPath     string
	ClassmapLeaves   int
	ClassmapError    string
	SupportListPath  string
	SupportListError string
	Notes            string
}

// EvaluateSpotifySupport builds a report for the raw version string.
// listPath may be empty to resolve via FindSupportedVersionsFile().
func EvaluateSpotifySupport(rawVersion, listPath string) SpotifySupportReport {
	report := SpotifySupportReport{
		RawVersion: rawVersion,
	}
	if listPath == "" {
		resolved, err := FindSupportedVersionsFile()
		if err != nil {
			report.SupportListError = err.Error()
		} else {
			listPath = resolved
		}
	}
	report.SupportListPath = listPath

	if rawVersion == "" {
		report.SupportListError = "empty Spotify version"
		return report
	}

	normalized, err := NormalizeSpotifyVersion(rawVersion)
	if err != nil {
		report.SupportListError = err.Error()
		return report
	}
	report.NormalizedVersion = normalized

	if listPath == "" {
		// No support list anywhere; still compute classmap key when possible.
		if info, mapErr := (&SupportList{}).MapInfoFor(normalized); mapErr == nil {
			report.Map = info
			report.Map.Status = ClassmapStatusNone
		}
		return report
	}

	list, err := LoadSupportedVersions(listPath)
	if err != nil {
		report.SupportListError = err.Error()
		// Still compute classmap key when possible.
		if info, mapErr := (&SupportList{}).MapInfoFor(normalized); mapErr == nil {
			report.Map = info
			report.Map.Status = ClassmapStatusNone
		}
		return report
	}

	report.Supported = list.IsSupported(normalized)
	report.ListAvailable = true
	info, err := list.MapInfoFor(normalized)
	if err != nil {
		report.SupportListError = err.Error()
		return report
	}
	report.Map = info
	if note, ok := list.Notes[normalized]; ok {
		report.Notes = note
	}

	path, findErr := FindClassmapFile(info.ClassmapKey)
	if findErr != nil {
		// Not an error for classic-only versions; record for display.
		report.ClassmapError = findErr.Error()
		return report
	}
	report.ClassmapPath = path

	cm, err := LoadClassmap(path)
	if err != nil {
		report.ClassmapError = err.Error()
		return report
	}
	report.ClassmapLeaves = cm.LeafCount()

	return report
}

// SummaryLine is a one-line human summary.
func (r SpotifySupportReport) SummaryLine() string {
	if r.NormalizedVersion == "" {
		return "Spotify version: unknown"
	}
	support := "unsupported"
	if r.Supported {
		support = "supported"
	}
	return fmt.Sprintf("Spotify %s (%s): %s; map=%s key=%s",
		r.RawVersion, r.NormalizedVersion, support, r.Map.Status, r.Map.ClassmapKey)
}
