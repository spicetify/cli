package cmd

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/spicetify/cli/src/utils"
)

// Update-blocking works the same way on every desktop platform: Spotify's
// self-updater fetches from a "desktop-update/v2/update" endpoint baked into
// the client binary, so overwriting that endpoint with an equal-length dead
// string ("no/thanks") makes the updater unreachable regardless of how the
// payload is fetched. Reversing the patch restores updates. Original
// approach from
// https://github.com/Delusoire/bespoke-cli/blob/main/cmd/spotify/update.go
const (
	updateEndpointPrefix  = "desktop-update/"
	updateEndpointLive    = updateEndpointPrefix + "v2/update"
	updateEndpointBlocked = updateEndpointPrefix + "no/thanks"
)

// patchUpdateEndpoint rewrites the desktop-update endpoint inside a Spotify
// binary image: "desktop-update/v2/update" <-> "desktop-update/no/thanks".
// Both variants are the same length, so the patch is length-preserving,
// reversible, and idempotent (re-running in the same direction is a no-op).
// It mutates raw in place and reports whether anything changed. Pure and
// platform-independent, so one unit test covers Windows, macOS, and Linux.
func patchUpdateEndpoint(raw []byte, block bool) ([]byte, bool) {
	from, to := updateEndpointLive, updateEndpointBlocked
	if !block {
		from, to = to, from
	}
	idx := bytes.Index(raw, []byte(from))
	if idx < 0 {
		return raw, false
	}
	copy(raw[idx+len(updateEndpointPrefix):], to[len(updateEndpointPrefix):])
	return raw, true
}

// spotifyBinaryPath returns the client executable to patch, or "" when the
// platform is unsupported.
func spotifyBinaryPath() string {
	dir := GetSpotifyPath()
	switch runtime.GOOS {
	case "windows":
		return filepath.Join(dir, "Spotify.exe")
	case "darwin":
		return filepath.Join(dir, "..", "MacOS", "Spotify")
	case "linux":
		return filepath.Join(dir, "spotify")
	}
	return ""
}

func blockVerb(block bool) string {
	if block {
		return "Disabled"
	}
	return "Enabled"
}

// BlockSpotifyUpdates asserts the desired update-blocking state on the client
// binary: it patches the update endpoint when a change is needed and is a
// quiet no-op when the binary is already in the requested state, so apply can
// re-assert it on every run. macOS additionally locks the update cache and
// re-signs the bundle ad-hoc (so it still launches on Apple Silicon). Linux
// installs served read-only by snap/flatpak cannot be patched in place and
// must be pinned via the package manager instead; that case is reported, not
// treated as a hard failure.
func BlockSpotifyUpdates(block bool) {
	binaryPath := spotifyBinaryPath()
	if binaryPath == "" {
		utils.PrintError("Update blocking is not supported on " + runtime.GOOS)
		return
	}

	raw, err := os.ReadFile(binaryPath)
	if err != nil {
		if runtime.GOOS == "linux" && errors.Is(err, fs.ErrNotExist) {
			utils.PrintWarning("Spotify binary not found at " + binaryPath +
				"; on snap/flatpak, block updates in your package manager instead.")
			return
		}
		utils.PrintError("Cannot read Spotify binary: " + err.Error())
		return
	}

	patched, changed := patchUpdateEndpoint(raw, block)

	// Already in the requested state and no cache lock to manage: stay
	// silent, since this runs on every apply. On darwin a block still
	// re-asserts the cache lock below even when the endpoint is unchanged.
	if !changed && (!block || runtime.GOOS != "darwin") {
		return
	}

	if changed {
		if runtime.GOOS == "darwin" {
			// Release the running executable before rewriting it in place.
			exec.Command("pkill", "Spotify").Run()
		}
		if err := os.WriteFile(binaryPath, patched, 0755); err != nil {
			if runtime.GOOS == "linux" && errors.Is(err, fs.ErrPermission) {
				utils.PrintWarning("Spotify binary is read-only (snap/flatpak?); block updates in your package manager instead.")
				return
			}
			utils.PrintError("Cannot write Spotify binary: " + err.Error())
			return
		}
		if runtime.GOOS == "darwin" {
			if err := codesignBundle(binaryPath); err != nil {
				utils.PrintWarning("Ad-hoc re-sign failed: " + err.Error())
			}
		}
	}

	if runtime.GOOS == "darwin" {
		setDarwinUpdateCacheLock(block)
	}

	if changed {
		utils.PrintSuccess(blockVerb(block) + " Spotify updates!")
	}
}

// setDarwinUpdateCacheLock toggles the immutable flag on Spotify's update
// cache directory. Current clients stage updates via a segmented downloader
// that does not reference this directory, so this is belt-and-suspenders on
// top of the endpoint patch, not sufficient on its own.
func setDarwinUpdateCacheLock(block bool) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return
	}
	updateDir := filepath.Join(homeDir, "Library", "Application Support", "Spotify", "PersistentCache", "Update")
	flag := "nouchg"
	if block {
		exec.Command("mkdir", "-p", updateDir).Run()
		flag = "uchg"
	}
	exec.Command("chflags", flag, updateDir).Run()
}

// codesignBundle ad-hoc re-signs the .app so a rewritten binary still
// launches on Apple Silicon (which rejects an unsigned/altered executable).
func codesignBundle(binaryPath string) error {
	bundlePath := filepath.Join(binaryPath, "..", "..", "..")
	if out, err := exec.Command("codesign", "--force", "--deep", "--sign", "-", bundlePath).CombinedOutput(); err != nil {
		return fmt.Errorf("%w (%s)", err, strings.TrimSpace(string(out)))
	}
	return nil
}
