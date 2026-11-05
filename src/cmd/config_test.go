package cmd

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/spicetify/cli/src/utils"
)

func loadTestConfig(t *testing.T, path string) {
	t.Helper()
	cfg = utils.ParseConfig(path)
	settingSection = cfg.GetSection("Setting")
	preprocSection = cfg.GetSection("Preprocesses")
	featureSection = cfg.GetSection("AdditionalOptions")
	moduleSection = cfg.GetSection("Module")
}

// A config written before update_policy existed must still accept the key, and
// the added empty value must keep the legacy block_spotify_updates bridge.
func TestEditConfigSetsUpdatePolicyOnAnOlderConfig(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config-xpui.ini")
	legacy := "[Setting]\nblock_spotify_updates = 1\n"
	if err := os.WriteFile(path, []byte(legacy), 0o644); err != nil {
		t.Fatal(err)
	}

	loadTestConfig(t, path)
	if key := searchField("update_policy"); key.Value() != "" {
		t.Fatalf("update_policy = %q, want empty", key.Value())
	}
	if got := EffectiveUpdatePolicy(); got != UpdatePolicyBlock {
		t.Fatalf("before setting update_policy: policy = %q, want %q", got, UpdatePolicyBlock)
	}

	loadTestConfig(t, path)
	EditConfig([]string{"update_policy", "allow"})

	loadTestConfig(t, path)
	if got := settingSection.Key("update_policy").String(); got != "allow" {
		t.Fatalf("saved update_policy = %q, want %q", got, "allow")
	}
	if got := EffectiveUpdatePolicy(); got != UpdatePolicyAllow {
		t.Fatalf("after setting update_policy: policy = %q, want %q", got, UpdatePolicyAllow)
	}
}
