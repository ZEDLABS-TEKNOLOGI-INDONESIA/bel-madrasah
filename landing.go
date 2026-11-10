package main

import (
	"net/http"
	"path/filepath"
)

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
