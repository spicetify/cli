package utils

import (
	"log"
	"os"
)

// Bold .
func Bold(text string) string {
	return "\x1B[1m" + text + "\033[0m"
}

// Red .
func Red(text string) string {
	return "\x1B[31m" + text + "\x1B[0m"
}

// Green .
func Green(text string) string {
	return "\x1B[32m" + text + "\x1B[0m"
}

// Yellow .
func Yellow(text string) string {
	return "\x1B[33m" + text + "\x1B[0m"
}

// Blue .
func Blue(text string) string {
	return "\x1B[34m" + text + "\x1B[0m"
}

// PrintBold prints a bold message
func PrintBold(text string) {
	log.Println(Bold(text))
}

// PrintRed prints a message in red color
func PrintRed(text string) {
	log.Println(Red(text))
}

// PrintGreen prints a message in green color
func PrintGreen(text string) {
	log.Println(Green(text))
}

// PrintNote prints a warning message
func PrintNote(text string) {
	log.Println(Bold(Yellow("note")), Bold(text))
}

// PrintWarning prints a warning message
func PrintWarning(text string) {
	log.Println(Yellow("warning"), text)
}

// PrintError prints an error message
func PrintError(text string) {
	log.Println(Red("error"), text)
}

// PrintSuccess prints a success message
func PrintSuccess(text string) {
	log.Println(Green("success"), text)
}

// PrintInfo prints an info message
func PrintInfo(text string) {
	log.Println(Blue("info"), text)
}

// Fatal prints fatal message and exits process
func Fatal(err error) {
	log.Println(Red("fatal"), err)
	os.Exit(1)
}
