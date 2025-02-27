//go:build !windows
// +build !windows

package isAdmin

import "os"

func Check(bypassAdminCheck bool) bool {
	if bypassAdminCheck {
		return false
	}
	return os.Geteuid() == 0
}
