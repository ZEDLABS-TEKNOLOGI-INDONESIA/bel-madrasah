package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

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
