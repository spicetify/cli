package utils

import (
	"fmt"
	"log"
	"strings"
)

// Tracker is used to hold, update and print progress info to console.
type Tracker struct {
	current int
	total   int
	maxLen  int
}

// NewTracker creates new tracker instance
func NewTracker(total int) *Tracker {
	t := &Tracker{0, total, 0}
	return t
}

// Update increases progress count and prints current progress.
func (t *Tracker) Update(name string) {
	t.current++
	line := fmt.Sprintf("\r[ %d / %d ] %s", t.current, t.total, name)
	lineLen := len(line)
	spaceLen := 0

	if lineLen > t.maxLen {
		t.maxLen = lineLen
	} else {
		spaceLen = t.maxLen - lineLen
	}

	fmt.Print(line + strings.Repeat(" ", spaceLen))
}

// Finish prints success message
func (t *Tracker) Finish() {
	log.Println("\r\x1B[32mOK\033[0m" + strings.Repeat(" ", t.maxLen-2))
}

// Reset .
func (t *Tracker) Reset() {
	t.current = 0
}
