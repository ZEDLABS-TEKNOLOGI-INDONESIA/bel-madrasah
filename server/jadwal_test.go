package main

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestResolveAudioPath(t *testing.T) {
	setupTestDir(t)
	cases := map[string]bool{
		"bel.mp3":                         true,
		filepath.Join(toneDir, "bel.mp3"): true,
		"":                                false,
		"../bel.mp3":                      false,
		"sub/bel.mp3":                     false,
		"/etc/passwd":                     false,
		toneDir:                           false,
		filepath.Join(toneDir, "..", "x"): false,
	}
	for in, ok := range cases {
		got, valid := resolveAudioPath(in)
		if valid != ok {
			t.Errorf("resolveAudioPath(%q) valid=%v, want %v", in, valid, ok)
		}
		if valid && filepath.Dir(got) != toneDir {
			t.Errorf("resolveAudioPath(%q) = %q, not inside toneDir", in, got)
		}
	}
}

func TestValidModesFollowAllModes(t *testing.T) {
	if len(validModes) != len(AllModes) {
		t.Fatalf("validModes %d, AllModes %d", len(validModes), len(AllModes))
	}
	for _, m := range AllModes {
		if !validModes[m] {
			t.Fatalf("mode %s missing", m)
		}
	}
}

func TestEntryAcceptsBareFilename(t *testing.T) {
	setupTestDir(t)
	rec := postJSON(t, handleJadwalEntry, map[string]any{
		"action": "add", "mode": "lainnya", "hari": "Senin",
		"entry": map[string]string{"waktu": "08:00", "audio": "bel.mp3"},
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	j, _ := loadJadwal()
	got := j["lainnya"]["Senin"]
	if len(got) != 1 || got[0].Audio != filepath.Join(toneDir, "bel.mp3") {
		t.Fatalf("entries %+v", got)
	}
}

func TestDeleteToneRemovesScheduleEntries(t *testing.T) {
	setupTestDir(t)
	writeTone(t, "sholawat.mp3")

	req := httptest.NewRequest(http.MethodGet, "/api/tones?per_page=500", nil)
	rec := httptest.NewRecorder()
	handleTones(rec, req)
	var list struct {
		Usage map[string]int `json:"usage"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	before := list.Usage["sholawat.mp3"]
	if before == 0 {
		t.Fatal("usage count missing for scheduled tone")
	}

	rec = postJSON(t, handleTonesDelete, map[string]string{"filename": "sholawat.mp3"})
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	var res struct {
		Removed int `json:"removed"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	if res.Removed != before {
		t.Fatalf("removed %d, usage was %d", res.Removed, before)
	}
	j, _ := loadJadwal()
	if n := toneUsage(j)["sholawat.mp3"]; n != 0 {
		t.Fatalf("%d entries still reference deleted tone", n)
	}
	if rec := postJSON(t, handleTonesDelete, map[string]string{"filename": "../x.mp3"}); rec.Code == http.StatusOK {
		t.Fatal("non-exact filename accepted")
	}
}

func TestRestoreRebasesForeignPaths(t *testing.T) {
	setupTestDir(t)
	backup := map[string]map[string][]Entry{
		"reguler": {"Senin": {{Waktu: "07:00", Audio: "/opt/lain/tone/bel.mp3"}}},
	}
	data, _ := json.Marshal(backup)
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile("file", "backup.json")
	_, _ = fw.Write(data)
	_ = mw.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/restore", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec := httptest.NewRecorder()
	handleRestore(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	j, _ := loadJadwal()
	if got := j["reguler"]["Senin"][0].Audio; got != filepath.Join(toneDir, "bel.mp3") {
		t.Fatalf("audio %q", got)
	}
}

func TestPanelPagesDiscoveredFromBuild(t *testing.T) {
	setupTestDir(t)
	for _, name := range []string{"index.html", "jadwal.html", "baru.html", "login.html", "404.html"} {
		_ = os.WriteFile(filepath.Join(staticDir, name), []byte(name), 0644)
	}
	cases := map[string]bool{
		"/": true, "/jadwal": true, "/baru": true,
		"/login": false, "/404": false, "/tidak-ada": false, "/jadwal.html": false, "/../x": false,
	}
	for path, want := range cases {
		if _, ok := panelPageFile(path); ok != want {
			t.Errorf("panelPageFile(%q) = %v, want %v", path, ok, want)
		}
	}
}
