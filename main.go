/*
 * Copyright (C) 2024 Delusoire
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

package main

import (
	"bespoke/cmd"
	"errors"
	"fmt"
	"log"
	"os"
	"strings"
)

func main() {
	u, err := validation(os.Args[1:])
	if err != nil {
		log.Fatalln(err)
	}

	fmt.Printf("URL: %s\n", u)

	if u != "" {
		cmd.HandleProtocol(u)
		return
	}

	cmd.Execute()
}

func validation(args []string) (string, error) {
	if len(args) == 0 {
		return "", errors.New("URL is required arguments")
	}

	if !strings.HasPrefix(args[0], "spicetify") {
		return "", errors.New("URL must start with spicetify://")
	}
	return args[0], nil
}
