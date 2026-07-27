package cmd

import (
	"bytes"
	"fmt"
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

// patchUpdateEndpoint rewrites every desktop-update endpoint in a Spotify
// binary image: "desktop-update/v2/update" <-> "desktop-update/no/thanks".
// Both variants are the same length, so the patch is length-preserving,
// reversible, and idempotent. It patches ALL occurrences (a universal
// Mach-O has one per arch slice, and patching only the first would leave the
// running slice's updater live), mutates raw in place, and reports whether
// anything changed. Pure and platform-independent, so one unit test covers
// Windows, macOS, and Linux.
func patchUpdateEndpoint(raw []byte, block bool) ([]byte, bool) {
	from, to := []byte(updateEndpointLive), []byte(updateEndpointBlocked)
	if !block {
		from, to = to, from
	}
	suffix := to[len(updateEndpointPrefix):]
	changed := false
	for off := 0; ; {
		i := bytes.Index(raw[off:], from)
		if i < 0 {
			break
		}
		i += off
		copy(raw[i+len(updateEndpointPrefix):], suffix)
		changed = true
		off = i + len(from)
	}
	return raw, changed
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

// killSpotify stops any running client so the binary can be replaced. On unix
// an atomic rename tolerates a running executable (the process keeps the old
// inode), but Windows locks the running image and macOS needs the process
// gone before re-signing, so both are killed before a write.
func killSpotify() {
	switch runtime.GOOS {
	case "windows":
		exec.Command("taskkill", "/IM", "Spotify.exe", "/F").Run()
	case "darwin":
		exec.Command("pkill", "Spotify").Run()
	case "linux":
		exec.Command("pkill", "-x", "spotify").Run()
	}
}

// replaceFileAtomically writes data to a sibling temp file and renames it over
// path, so an interrupted write can never leave a half-written (corrupt)
// binary — the original stays intact until the atomic rename swaps it in. On a
// read-only install the temp create fails before anything is disturbed.
func replaceFileAtomically(path string, data []byte, perm os.FileMode) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".spicetify-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmpName, perm); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
}

// BlockSpotifyUpdates asserts the desired update-blocking state on the client
// binary: it patches the update endpoint when a change is needed and is a
// quiet no-op when the binary is already in the requested state, so apply can
// re-assert it on every run. The write is atomic (temp + rename) so an
// interruption never corrupts the binary. macOS additionally locks the update
// cache and re-signs the bundle ad-hoc (Apple Silicon rejects an altered
// unsigned binary); if the re-sign fails the original binary is restored
// rather than left altered-and-unsigned. Linux installs served read-only by
// snap/flatpak cannot be patched and must be pinned via the package manager
// instead; that case is reported, not treated as a hard failure.
func BlockSpotifyUpdates(block bool) {
	binaryPath := spotifyBinaryPath()
	if binaryPath == "" {
		utils.PrintError("Update blocking is not supported on " + runtime.GOOS)
		return
	}

	raw, err := os.ReadFile(binaryPath)
	if err != nil {
		if runtime.GOOS == "linux" && os.IsNotExist(err) {
			utils.PrintWarning("Spotify binary not found at " + binaryPath +
				"; on snap/flatpak, block updates in your package manager instead.")
			return
		}
		utils.PrintError("Cannot read Spotify binary: " + err.Error())
		return
	}

	original := bytes.Clone(raw)
	patched, changed := patchUpdateEndpoint(raw, block)

	// Already in the requested state and no cache lock to manage: stay silent,
	// since this runs on every apply. On darwin a block still re-asserts the
	// cache lock below even when the endpoint is unchanged.
	if !changed && (!block || runtime.GOOS != "darwin") {
		return
	}

	if changed {
		killSpotify()
		if err := replaceFileAtomically(binaryPath, patched, 0755); err != nil {
			if runtime.GOOS == "linux" {
				utils.PrintWarning("Could not write the Spotify binary (read-only install? snap/flatpak users must " +
					"block updates in the package manager): " + err.Error())
				return
			}
			utils.PrintError("Cannot write Spotify binary: " + err.Error())
			return
		}
		if runtime.GOOS == "darwin" {
			if err := codesignBundle(binaryPath); err != nil {
				// Never leave an altered, unsigned executable that will not
				// launch: restore the pristine binary and fail loudly.
				if rerr := replaceFileAtomically(binaryPath, original, 0755); rerr != nil {
					utils.PrintError("Ad-hoc re-sign failed AND restoring the original failed: " + rerr.Error())
				} else {
					utils.PrintError("Ad-hoc re-sign failed; restored the original binary, re-run apply. (" + err.Error() + ")")
				}
				return
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

// codesignBundle ad-hoc re-signs the .app so a rewritten binary still launches
// on Apple Silicon (which rejects an unsigned/altered executable).
func codesignBundle(binaryPath string) error {
	bundlePath := filepath.Join(binaryPath, "..", "..", "..")
	if out, err := exec.Command("codesign", "--force", "--deep", "--sign", "-", bundlePath).CombinedOutput(); err != nil {
		return fmt.Errorf("%w (%s)", err, strings.TrimSpace(string(out)))
	}
	return nil
}
