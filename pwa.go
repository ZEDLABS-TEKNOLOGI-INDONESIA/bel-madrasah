package main

import (
	"net/http"
	"path/filepath"
)

func registerPWARoutes(mux *http.ServeMux) {
	mux.HandleFunc("/sw.js", handleServiceWorker)
}

func handleServiceWorker(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/javascript")
	w.Header().Set("Service-Worker-Allowed", "/")
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeFile(w, r, filepath.Join(staticDir, "sw.js"))
}
