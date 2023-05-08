package utils

import (
	"bufio"
	"fmt"
	"os/exec"
)

// CmdScanner is a helper function to scan output from exec.Cmd
func CmdScanner(cmd *exec.Cmd) {
	stdout, _ := cmd.StdoutPipe()
	cmd.Start()

	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		m := scanner.Text()
		fmt.Println(m)
	}
	cmd.Wait()
}
