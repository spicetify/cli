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

// Block spotify updates. Taken from https://github.com/Delusoire/bespoke-cli/blob/main/cmd/spotify/update.go
func BlockSpotifyUpdates(disabled bool) {
	if runtime.GOOS == "linux" {
		utils.PrintError("Auto-updates on linux should be disabled in package manager you installed spotify with.")
		return
	}
	spotifyExecPath := GetSpotifyPath()
	switch runtime.GOOS {
	case "windows":
		spotifyExecPath = filepath.Join(spotifyExecPath, "Spotify.exe")
	case "darwin":
		spotifyExecPath = filepath.Join(spotifyExecPath, "..", "MacOS", "Spotify")
	}

	var str, msg string
	if runtime.GOOS == "darwin" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			utils.PrintError("Cannot get user home directory")
			return
		}
		updateDir := homeDir + "/Library/Application Support/Spotify/PersistentCache/Update"
		exec.Command("pkill", "Spotify").Run()
		exec.Command("mkdir", "-p", updateDir).Run()
		if disabled {
			exec.Command("chflags", "uchg", updateDir).Run()
			msg = "Disabled"
		} else {
			exec.Command("chflags", "nouchg", updateDir).Run()
			msg = "Enabled"
		}

		// chflags alone is not enough anymore: current clients stage updates
		// via a segmented downloader that does not reference that directory.
		// Patching the update endpoint makes the updater unreachable
		// regardless of how the payload is fetched.
		if err := patchDarwinUpdateEndpoint(spotifyExecPath, disabled); err != nil {
			utils.PrintWarning("Endpoint patch failed (lock still applied): " + err.Error())
		}

		utils.PrintSuccess(msg + " Spotify updates!")
		return
	}

	file, err := os.OpenFile(spotifyExecPath, os.O_RDWR, 0644)
	if err != nil {
		utils.Fatal(err)
		return
	}
	defer file.Close()

	buf := new(bytes.Buffer)
	buf.ReadFrom(file)
	content := buf.String()

	i := strings.Index(content, "desktop-update/")
	if i == -1 {
		utils.PrintError("Can't find update endpoint in executable")
		return
	}
	if disabled {
		str = "no/thanks"
		msg = "Disabled"
	} else {
		str = "v2/update"
		msg = "Enabled"
	}
	file.WriteAt([]byte(str), int64(i+15))
	utils.PrintSuccess(msg + " Spotify updates!")
}

const (
	darwinUpdateEndpoint         = "desktop-update/v2/update"
	darwinUpdateEndpointPatched  = "desktop-update/no/thanks"
	darwinUpdateEndpointPatchOff = len("desktop-update/")
)

// patchDarwinUpdateEndpoint rewrites the desktop-update endpoint inside the
// Spotify binary and re-signs the bundle ad-hoc so it still launches on
// Apple Silicon. Blocking writes "no/thanks" over "v2/update"; unblocking
// restores the original bytes (from the backup taken on first block, or by
// reversing the patch).
func patchDarwinUpdateEndpoint(binaryPath string, block bool) error {
	raw, err := os.ReadFile(binaryPath)
	if err != nil {
		return err
	}

	backupPath := filepath.Join(utils.GetSpicetifyFolder(), "spotify-binary-backup")

	if block {
		if !bytes.Contains(raw, []byte(darwinUpdateEndpoint)) {
			// Already patched (or the endpoint moved): nothing to do.
			return nil
		}
		if _, err := os.Stat(backupPath); os.IsNotExist(err) {
			if err := os.WriteFile(backupPath, raw, 0755); err != nil {
				return fmt.Errorf("cannot back up binary: %w", err)
			}
		}
		idx := bytes.Index(raw, []byte(darwinUpdateEndpoint))
		copy(raw[idx+darwinUpdateEndpointPatchOff:], "no/thanks")
	} else {
		if st, err := os.Stat(backupPath); err == nil && !st.IsDir() {
			raw, err = os.ReadFile(backupPath)
			if err != nil {
				return err
			}
		} else {
			idx := bytes.Index(raw, []byte(darwinUpdateEndpointPatched))
			if idx < 0 {
				return fmt.Errorf("patched endpoint not found and no backup to restore")
			}
			copy(raw[idx+darwinUpdateEndpointPatchOff:], "v2/update")
		}
	}

	if err := os.WriteFile(binaryPath, raw, 0755); err != nil {
		return err
	}

	bundlePath := filepath.Join(binaryPath, "..", "..", "..")
	if out, err := exec.Command("codesign", "--force", "--deep", "--sign", "-", bundlePath).CombinedOutput(); err != nil {
		return fmt.Errorf("codesign failed: %w (%s)", err, strings.TrimSpace(string(out)))
	}
	return nil
}
