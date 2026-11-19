package utils

import "testing"

func TestReplaceEnvVarsInString(t *testing.T) {
	// Set the shorter name first so it precedes the longer one in
	// os.Environ().
	t.Setenv("SPT_TEST_DIR", "/short")
	t.Setenv("SPT_TEST_DIR_EXTRA", "/long")
	t.Setenv("SPT_TEST_EMPTY", "")

	cases := map[string]string{
		"$SPT_TEST_DIR/Apps":                "/short/Apps",
		"$SPT_TEST_DIR_EXTRA/Apps":          "/long/Apps",
		"$SPT_TEST_DIR:$SPT_TEST_DIR_EXTRA": "/short:/long",
		"$SPT_TEST_EMPTY/x":                 "/x",
		"$SPT_TEST_UNSET/x":                 "$SPT_TEST_UNSET/x",
		"no variables":                      "no variables",
	}
	for in, want := range cases {
		if got := ReplaceEnvVarsInString(in); got != want {
			t.Errorf("ReplaceEnvVarsInString(%q) = %q, want %q", in, got, want)
		}
	}
}
