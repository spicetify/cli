package cmd

import "testing"

func TestFindOfflineBnkDeveloperFlagOffsetsNoMatches(t *testing.T) {
	_, _, err := findOfflineBnkDeveloperFlagOffsets("offline cache without the marker")
	if err == nil {
		t.Fatal("expected an error when the developer marker is missing")
	}

	want := "cannot enable devtools safely: \"app-developer\" marker not found in offline.bnk"
	if err.Error() != want {
		t.Fatalf("expected error %q, got %q", want, err.Error())
	}
}

func TestFindOfflineBnkDeveloperFlagOffsetsSingleMatch(t *testing.T) {
	prefix := "aa"
	content := prefix + offlineBnkDeveloperMarker + "xyz"

	firstOffset, secondOffset, err := findOfflineBnkDeveloperFlagOffsets(content)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	wantFirstOffset := int64(len(prefix) + 14)
	if firstOffset != wantFirstOffset {
		t.Fatalf("expected first offset %d, got %d", wantFirstOffset, firstOffset)
	}

	wantSecondOffset := int64(len(prefix) + 15)
	if secondOffset != wantSecondOffset {
		t.Fatalf("expected second offset %d, got %d", wantSecondOffset, secondOffset)
	}
}

func TestFindOfflineBnkDeveloperFlagOffsetsTwoMatches(t *testing.T) {
	prefix := "aa"
	betweenMarkers := "bb"
	content := prefix + offlineBnkDeveloperMarker + betweenMarkers + offlineBnkDeveloperMarker + "xyz"

	firstOffset, secondOffset, err := findOfflineBnkDeveloperFlagOffsets(content)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	wantFirstOffset := int64(len(prefix) + 14)
	if firstOffset != wantFirstOffset {
		t.Fatalf("expected first offset %d, got %d", wantFirstOffset, firstOffset)
	}

	secondMarkerIndex := len(prefix) + len(offlineBnkDeveloperMarker) + len(betweenMarkers)
	wantSecondOffset := int64(secondMarkerIndex + 15)
	if secondOffset != wantSecondOffset {
		t.Fatalf("expected second offset %d, got %d", wantSecondOffset, secondOffset)
	}
}
