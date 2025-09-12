package utils

import (
	"log"
	"os"
	"time"

	"github.com/pterm/pterm"
)

var (
	Info = pterm.PrefixPrinter{
		Prefix: pterm.Prefix{
			Text:  "info",
			Style: &pterm.Style{pterm.FgBlue},
		},
	}
	Success = pterm.PrefixPrinter{
		Prefix: pterm.Prefix{
			Text:  "success",
			Style: &pterm.Style{pterm.FgGreen},
		},
	}
	Warning = pterm.PrefixPrinter{
		Prefix: pterm.Prefix{
			Text:  "warning",
			Style: &pterm.Style{pterm.FgYellow},
		},
	}
	Error = pterm.PrefixPrinter{
		Prefix: pterm.Prefix{
			Text:  "error",
			Style: &pterm.Style{pterm.FgRed},
		},
	}
	Note = pterm.PrefixPrinter{
		Prefix: pterm.Prefix{
			Text:  "note",
			Style: &pterm.Style{pterm.FgYellow},
		},
	}
	FatalPrefix = pterm.PrefixPrinter{
		Prefix: pterm.Prefix{
			Text:  "fatal",
			Style: &pterm.Style{pterm.BgRed, pterm.FgBlack},
		},
	}
	Spinner = pterm.SpinnerPrinter{
		Sequence:       []string{"-", "\\", "|", "/"},
		Style:          &pterm.ThemeDefault.SpinnerStyle,
		Delay:          time.Millisecond * 200,
		TimerStyle:     &pterm.ThemeDefault.TimerStyle,
		MessageStyle:   &pterm.ThemeDefault.SpinnerTextStyle,
		InfoPrinter:    &Info,
		SuccessPrinter: &Success,
		FailPrinter:    &Error,
		WarningPrinter: &Warning,
		Writer:         os.Stderr,
	}
)

// Bold .
func Bold(text string) string {
	return "\x1B[1m" + text + "\033[0m"
}

// Red .
func Red(text string) string {
	return "\x1B[31m" + text + "\x1B[0m"
}

// PrintBold prints a bold message
func PrintBold(text string) {
	log.Println(Bold(text))
}

// PrintNote prints a warning message
func PrintNote(text string) {
	Note.Println(text)
}

// PrintWarning prints a warning message
func PrintWarning(text string) {
	Warning.Println(text)
}

// PrintError prints an error message
func PrintError(text string) {
	Error.Println(text)
}

// PrintSuccess prints a success message
func PrintSuccess(text string) {
	Success.Println(text)
}

// PrintInfo prints an info message
func PrintInfo(text string) {
	Info.Println(text)
}

// Fatal prints fatal message and exits process
func Fatal(err error) {
	FatalPrefix.Println(err.Error())
	os.Exit(1)
}
