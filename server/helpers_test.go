package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
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
