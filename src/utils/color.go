package utils

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

type color struct {
	rgbValue string
	hexValue string
}

// Color stores hex and rgb value of color
type Color interface {
	Hex() string
	RGB() string
}

// ParseColor parses a string in both hex or rgb
// and converts to both rgb and hex value
func ParseColor(raw string) Color {
	var red int64
	var green int64
	var blue int64
	var err error
	// rrr,bbb,ggg
	if strings.Contains(raw, ",") {
		list := strings.SplitN(raw, ",", 3)
		list = append(list, "255", "255")

		red, err = strconv.ParseInt(list[0], 10, 64)
		if err != nil {
			red = 255
		}

		green, err = strconv.ParseInt(list[1], 10, 64)
		if err != nil {
			green = 255
		}

		blue, err = strconv.ParseInt(list[2], 10, 64)
		if err != nil {
			blue = 255
		}

	} else {
		re := regexp.MustCompile("[a-fA-F0-9]+")
		hex := re.FindString(raw)
		hex += "ffffff"
		red, err = strconv.ParseInt(hex[:2], 16, 64)
		if err != nil {
			red = 255
		}

		green, err = strconv.ParseInt(hex[2:4], 16, 64)
		if err != nil {
			green = 255
		}

		blue, err = strconv.ParseInt(hex[4:6], 16, 64)
		if err != nil {
			blue = 255
		}
	}

	if red < 0 {
		red = 0
	}
	if red > 255 {
		red = 255
	}

	if green < 0 {
		green = 0
	}
	if green > 255 {
		green = 255
	}

	if blue < 0 {
		blue = 0
	}
	if blue > 255 {
		blue = 255
	}

	return color{
		rgbValue: fmt.Sprintf("%d,%d,%d", red, green, blue),
		hexValue: fmt.Sprintf("%02x%02x%02x", red, green, blue)}
}

func (c color) Hex() string {
	return c.hexValue
}

func (c color) RGB() string {
	return c.rgbValue
}
