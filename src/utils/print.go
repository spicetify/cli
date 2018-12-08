package utils

import (
	"log"
	"os"
)

// PrintWarning prints a warning message
func PrintWarning(text string) {
	log.Println("\x1B[33mwarning\033[0m", text)
}

// PrintError prints an error message
func PrintError(text string) {
	log.Println("\x1B[31merror\033[0m", text)
}

// PrintSuccess prints a success message
func PrintSuccess(text string) {
	log.Println("\x1B[32msuccess\033[0m", text)
}

// PrintInfo prints an info message
func PrintInfo(text string) {
	log.Println("\x1B[34minfo\033[0m", text)
}

// PrintGreen prints a message in green color
func PrintGreen(text string) {
	log.Println("\x1B[32m" + text + "\033[0m")
}

// PrintRed prints a red message
func PrintRed(text string) {
	log.Println("\x1B[31m" + text + "\033[0m")
}

// PrintBold prints a bold message
func PrintBold(text string) {
	log.Println("\x1B[1m" + text + "\033[0m")
}

// Fatal prints fatal message and exits process
func Fatal(err error) {
	log.Println("\x1B[31mfatal\033[0m", err)
	os.Exit(1)
}
