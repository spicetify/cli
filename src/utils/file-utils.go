package utils

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"os"
	"unicode/utf16"
)

func ReadStringFromUTF16Binary(inputFile string, startMarker []byte, endMarker []byte) (string, int, int, error) {
	fileContent, err := os.ReadFile(inputFile)
	if err != nil {
		return "", -1, -1, fmt.Errorf("error reading file %s: %w", inputFile, err)
	}

	isUTF16LE := false
	if len(fileContent) >= 2 && fileContent[0] == 0xFF && fileContent[1] == 0xFE {
		isUTF16LE = true
	}

	if !isUTF16LE && len(fileContent) > 100 && fileContent[1] == 0x00 {
		isUTF16LE = true
	}

	var startIdx, endIdx int
	var contentToSearch []byte
	var searchStartMarker, searchEndMarker []byte

	if !isUTF16LE {
		return "", -1, -1, fmt.Errorf("file is not in UTF-16LE format: %s", inputFile)
	}

	contentToSearch = fileContent[2:]
	searchStartMarker = encodeUTF16LE(startMarker)
	searchEndMarker = encodeUTF16LE(endMarker)

	startIdx = bytes.Index(contentToSearch, searchStartMarker)
	if startIdx == -1 {
		return "", -1, -1, fmt.Errorf("start marker not found: %s", string(startMarker))
	}

	searchSpace := contentToSearch[startIdx+len(searchStartMarker):]
	endIdx = bytes.Index(searchSpace, searchEndMarker)
	if endIdx == -1 {
		return "", -1, -1, fmt.Errorf("end marker not found after start index %d: %s", startIdx+len(searchStartMarker), string(endMarker))
	}

	stringContentBytes := contentToSearch[startIdx : startIdx+len(searchStartMarker)+endIdx+len(searchEndMarker)]

	decodedStringBytes, err := decodeUTF16LE(stringContentBytes)
	if err != nil {
		return "", -1, -1, fmt.Errorf("error decoding UTF-16LE content: %w", err)
	}

	// Adjust indices to be byte offsets in the original file
	originalStartIdx := 2 + startIdx
	originalEndIdx := 2 + endIdx + len(stringContentBytes)
	return string(decodedStringBytes), originalStartIdx, originalEndIdx, nil
}

// Helper function to encode a byte slice (assumed UTF-8) to UTF-16LE
func encodeUTF16LE(data []byte) []byte {
	utf16Bytes := utf16.Encode([]rune(string(data)))
	byteSlice := make([]byte, len(utf16Bytes)*2)
	for i, r := range utf16Bytes {
		binary.LittleEndian.PutUint16(byteSlice[i*2:], r)
	}

	return byteSlice
}

// Helper function to decode a byte slice (UTF-16LE) to UTF-8
func decodeUTF16LE(data []byte) ([]byte, error) {
	if len(data)%2 != 0 {
		return nil, fmt.Errorf("invalid UTF-16LE data length")
	}

	uint16s := make([]uint16, len(data)/2)
	for i := 0; i < len(data)/2; i++ {
		uint16s[i] = binary.LittleEndian.Uint16(data[i*2:])
	}

	runes := utf16.Decode(uint16s)
	return []byte(string(runes)), nil
}
