package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"
)

func TestSanitizeFilename(t *testing.T) {
	cases := map[string]string{
		"Bel Masuk.MP3":      "bel-masuk.mp3",
		"__a  b__.wav":       "a-b.wav",
		"Istirahat (1).ogg":  "istirahat-1.ogg",
		"!!!.mp3":            "audio.mp3",
		"pelajaran--2--.mp3": "pelajaran-2.mp3",
	}
	for in, want := range cases {
		if got := sanitizeFilename(in); got != want {
			t.Errorf("sanitizeFilename(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestRenameTarget(t *testing.T) {
	cases := []struct {
		old, input, want string
		fail             bool
	}{
		{"bel.mp3", "Bel Pulang", "bel-pulang.mp3", false},
		{"bel.mp3", "bel-pulang.mp3", "bel-pulang.mp3", false},
		{"bel.mp3", "bel-pulang.wav", "bel-pulang.mp3", false},
		{"bel.ogg", "versi.2", "versi2.ogg", false},
		{"bel.mp3", "   ", "", true},
		{"bel.mp3", "../etc/passwd", "", true},
		{"bel.mp3", "a\\b", "", true},
	}
	for _, c := range cases {
		got, err := renameTarget(c.old, c.input)
		if c.fail {
			if err == nil {
				t.Errorf("renameTarget(%q, %q) should fail, got %q", c.old, c.input, got)
			}
			continue
		}
		if err != nil || got != c.want {
			t.Errorf("renameTarget(%q, %q) = %q, %v, want %q", c.old, c.input, got, err, c.want)
		}
	}
}

func TestRenameUpdatesSchedule(t *testing.T) {
	setupTestDir(t)
	writeTone(t, "sholawat.mp3")

	rec := postJSON(t, handleTonesRename, map[string]string{
		"filename": "sholawat.mp3",
		"new_name": "Sholawat Pagi",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var res struct {
		Filename string `json:"filename"`
		Updated  int    `json:"updated"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	if res.Filename != "sholawat-pagi.mp3" {
		t.Fatalf("filename %q", res.Filename)
	}
	if res.Updated == 0 {
		t.Fatal("expected schedule entries to be updated")
	}
	if _, err := os.Stat(filepath.Join(toneDir, "sholawat-pagi.mp3")); err != nil {
		t.Fatal("renamed file missing")
	}

	j, err := loadJadwal()
	if err != nil {
		t.Fatal(err)
	}
	oldPath := filepath.Join(toneDir, "sholawat.mp3")
	newPath := filepath.Join(toneDir, "sholawat-pagi.mp3")
	found := 0
	for _, days := range j {
		for _, entries := range days {
			for _, e := range entries {
				if e.Audio == oldPath {
					t.Fatal("old path still referenced")
				}
				if e.Audio == newPath {
					found++
				}
			}
		}
	}
	if found != res.Updated {
		t.Fatalf("found %d entries, response said %d", found, res.Updated)
	}
}

func TestRenameRejectsConflictAndMissing(t *testing.T) {
	setupTestDir(t)
	writeTone(t, "a.mp3")
	writeTone(t, "b.mp3")

	if rec := postJSON(t, handleTonesRename, map[string]string{"filename": "a.mp3", "new_name": "b"}); rec.Code != http.StatusConflict {
		t.Fatalf("conflict: status %d", rec.Code)
	}
	if rec := postJSON(t, handleTonesRename, map[string]string{"filename": "x.mp3", "new_name": "c"}); rec.Code != http.StatusNotFound {
		t.Fatalf("missing: status %d", rec.Code)
	}
	if rec := postJSON(t, handleTonesRename, map[string]string{"filename": "../a.mp3", "new_name": "c"}); rec.Code == http.StatusOK {
		t.Fatal("traversal accepted")
	}
	if _, err := os.Stat(filepath.Join(toneDir, "a.mp3")); err != nil {
		t.Fatal("source file must be untouched")
	}
}
