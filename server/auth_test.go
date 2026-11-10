package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

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
