package main

import (
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

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
