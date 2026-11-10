package main

import (
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var publicPages = map[string]bool{"login": true, "landing": true, "404": true}

var pageName = regexp.MustCompile(`^[a-z0-9-]+$`)

func panelPageFile(path string) (string, bool) {
	name := strings.TrimPrefix(path, "/")
	if name == "" {
		name = "index"
	}
	if !pageName.MatchString(name) || publicPages[name] {
		return "", false
	}
	full := filepath.Join(staticDir, name+".html")
	if st, err := os.Stat(full); err != nil || st.IsDir() {
		return "", false
	}
	return full, true
}

func handlePages(w http.ResponseWriter, r *http.Request) {
	if full, ok := panelPageFile(r.URL.Path); ok {
		if servePrecompressed(w, r, full) {
			return
		}
		http.ServeFile(w, r, full)
		return
	}
	notFoundPath := filepath.Join(staticDir, "404.html")
	if data, err := os.ReadFile(notFoundPath); err == nil {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write(data)
		return
	}
	http.NotFound(w, r)
}

func registerLandingRoutes(mux *http.ServeMux, authedPages http.HandlerFunc) {
	mux.HandleFunc("/landing", handleLanding)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" && getSession(r) == nil {
			http.Redirect(w, r, "/landing", http.StatusSeeOther)
			return
		}
		authedPages(w, r)
	})
}

func handleLanding(w http.ResponseWriter, r *http.Request) {
	if getSession(r) != nil {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	full := filepath.Join(staticDir, "landing.html")
	if servePrecompressed(w, r, full) {
		return
	}
	http.ServeFile(w, r, full)
}

func registerPWARoutes(mux *http.ServeMux) {
	mux.HandleFunc("/sw.js", handleServiceWorker)
}

func handleServiceWorker(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/javascript")
	w.Header().Set("Service-Worker-Allowed", "/")
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeFile(w, r, filepath.Join(staticDir, "sw.js"))
}

var encodings = []struct {
	name string
	ext  string
}{
	{"br", ".br"},
	{"gzip", ".gz"},
}

func servePrecompressed(w http.ResponseWriter, r *http.Request, full string) bool {
	accept := r.Header.Get("Accept-Encoding")
	for _, enc := range encodings {
		if !strings.Contains(accept, enc.name) {
			continue
		}
		f, err := os.Open(full + enc.ext)
		if err != nil {
			continue
		}
		defer f.Close()
		st, err := f.Stat()
		if err != nil || st.IsDir() {
			continue
		}
		if ct := mime.TypeByExtension(filepath.Ext(full)); ct != "" {
			w.Header().Set("Content-Type", ct)
		}
		w.Header().Set("Content-Encoding", enc.name)
		w.Header().Add("Vary", "Accept-Encoding")
		http.ServeContent(w, r, full, st.ModTime(), f)
		return true
	}
	return false
}

func handleAstroAssets(w http.ResponseWriter, r *http.Request) {
	full := filepath.Join(staticDir, filepath.Clean("/"+r.URL.Path))
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	if servePrecompressed(w, r, full) {
		return
	}
	http.ServeFile(w, r, full)
}
