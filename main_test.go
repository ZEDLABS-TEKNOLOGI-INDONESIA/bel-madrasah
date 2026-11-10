package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func setupTestDir(t *testing.T) {
	t.Helper()
	setBaseDir(t.TempDir())
	for _, d := range []string{toneDir, dataDir, staticDir} {
		if err := os.MkdirAll(d, 0755); err != nil {
			t.Fatal(err)
		}
	}
	if err := initStorage(); err != nil {
		t.Fatal(err)
	}
	sessionsMu.Lock()
	sessions = make(map[string]*Session)
	sessionsMu.Unlock()
}

func writeTone(t *testing.T, name string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(toneDir, name), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
}

func postJSON(t *testing.T, h http.HandlerFunc, body any) *httptest.ResponseRecorder {
	t.Helper()
	data, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h(rec, req)
	return rec
}

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

func TestEqualizerFilters(t *testing.T) {
	if f := equalizerFilters(Equalizer{Enabled: false, Gains: []float64{6, 0, 0, 0, 0}}); f != nil {
		t.Fatalf("disabled equalizer produced %v", f)
	}
	if f := equalizerFilters(Equalizer{Enabled: true, Gains: []float64{0, 0, 0, 0, 0}}); len(f) != 0 {
		t.Fatalf("flat equalizer produced %v", f)
	}
	got := strings.Join(equalizerFilters(Equalizer{Enabled: true, Gains: []float64{4, 0, -3, 0, 2}}), ",")
	want := "lowshelf=f=60:g=4.0,equalizer=f=1000:t=o:w=2:g=-3.0,highshelf=f=12000:g=2.0,alimiter=limit=0.95"
	if got != want {
		t.Fatalf("got %s\nwant %s", got, want)
	}
	cut := strings.Join(equalizerFilters(Equalizer{Enabled: true, Gains: []float64{-4, 0, 0, 0, 0}}), ",")
	if strings.Contains(cut, "alimiter") {
		t.Fatal("limiter should only be added when a band is boosted")
	}
	chain := audioFilterChain(Config{Volume: 0.5, Equalizer: Equalizer{Enabled: true, Gains: []float64{0, 3, 0, 0, 0}}})
	if !strings.HasSuffix(chain, ",volume=0.50") || !strings.HasPrefix(chain, "equalizer=f=250") {
		t.Fatalf("chain %s", chain)
	}
}

func TestEqualizerNormalizeAndValidate(t *testing.T) {
	n := normalizeEqualizer(Equalizer{Gains: []float64{20, -30}})
	if len(n.Gains) != len(eqFrequencies) || n.Gains[0] != eqMaxGain || n.Gains[1] != eqMinGain || n.Gains[4] != 0 {
		t.Fatalf("normalize %v", n.Gains)
	}
	if validateEqualizer(Equalizer{Gains: []float64{0, 0}}) == nil {
		t.Fatal("short band list accepted")
	}
	if validateEqualizer(Equalizer{Gains: []float64{0, 0, 13, 0, 0}}) == nil {
		t.Fatal("out of range gain accepted")
	}
}

func TestEqualizerEndpointAndConfigPreserve(t *testing.T) {
	setupTestDir(t)
	rec := postJSON(t, handleEqualizer, Equalizer{Enabled: true, Gains: []float64{3, 0, 0, 0, -2}})
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if rec := postJSON(t, handleConfig, map[string]any{"mode": "reguler", "volume": 1}); rec.Code != http.StatusOK {
		t.Fatalf("config status %d", rec.Code)
	}
	cfg, _ := loadConfig()
	if !cfg.Equalizer.Enabled || cfg.Equalizer.Gains[0] != 3 || cfg.Equalizer.Gains[4] != -2 {
		t.Fatalf("equalizer lost after config save: %+v", cfg.Equalizer)
	}
}

func TestSessionsPersistAcrossRestart(t *testing.T) {
	setupTestDir(t)
	token, err := createSession("administrator")
	if err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(sessionsFile)
	if strings.Contains(string(data), token) {
		t.Fatal("raw token written to disk")
	}

	sessionsMu.Lock()
	sessions = make(map[string]*Session)
	sessions["expired"] = &Session{Username: "x", ExpiresAt: time.Now().Add(-time.Hour)}
	sessionsMu.Unlock()
	loadSessions()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: cookieName, Value: token})
	if getSession(req) == nil {
		t.Fatal("session not restored")
	}

	deleteSession(token)
	sessionsMu.Lock()
	sessions = make(map[string]*Session)
	sessionsMu.Unlock()
	loadSessions()
	if getSession(req) != nil {
		t.Fatal("deleted session restored")
	}
}

func TestPublicRoutingContract(t *testing.T) {
	setupTestDir(t)
	for _, name := range []string{"landing.html", "index.html", "login.html", "404.html"} {
		_ = os.WriteFile(filepath.Join(staticDir, name), []byte(name), 0644)
	}
	mux := http.NewServeMux()
	registerRoutes(mux)

	token, _ := createSession("administrator")
	do := func(path string, authed bool, header map[string]string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		if authed {
			req.AddCookie(&http.Cookie{Name: cookieName, Value: token})
		}
		for k, v := range header {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		return rec
	}

	cases := []struct {
		path     string
		authed   bool
		header   map[string]string
		code     int
		location string
	}{
		{"/", false, nil, http.StatusSeeOther, "/landing"},
		{"/", true, nil, http.StatusOK, ""},
		{"/landing", false, nil, http.StatusOK, ""},
		{"/landing", true, nil, http.StatusSeeOther, "/"},
		{"/login", true, nil, http.StatusSeeOther, "/"},
		{"/jadwal", false, nil, http.StatusSeeOther, "/login"},
		{"/api/config", false, map[string]string{"Accept": "application/json"}, http.StatusUnauthorized, ""},
		{"/tidak-ada", true, nil, http.StatusNotFound, ""},
		{"/healthz", false, nil, http.StatusOK, ""},
	}
	for _, c := range cases {
		rec := do(c.path, c.authed, c.header)
		if rec.Code != c.code {
			t.Errorf("%s authed=%v: status %d, want %d", c.path, c.authed, rec.Code, c.code)
			continue
		}
		if c.location != "" && rec.Header().Get("Location") != c.location {
			t.Errorf("%s authed=%v: location %q, want %q", c.path, c.authed, rec.Header().Get("Location"), c.location)
		}
	}
}
