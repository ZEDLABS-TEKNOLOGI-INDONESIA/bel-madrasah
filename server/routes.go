package main

import (
	"net/http"
	"path/filepath"
)

func registerRoutes(mux *http.ServeMux) {
	registerPWARoutes(mux)

	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))
	mux.HandleFunc("/_astro/", handleAstroAssets)
	mux.HandleFunc("/icons/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=604800")
		http.FileServer(http.Dir(staticDir)).ServeHTTP(w, r)
	})

	for _, name := range []string{"icon.svg", "favicon.ico", "manifest.json", "robots.txt"} {
		serveFile := filepath.Join(staticDir, name)
		mux.HandleFunc("/"+name, func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "public, max-age=86400")
			http.ServeFile(w, r, serveFile)
		})
	}

	mux.HandleFunc("/healthz", handleHealth)
	mux.HandleFunc("/login", handleLogin)
	mux.HandleFunc("/logout", handleLogout)
	registerLandingRoutes(mux, requireAuth(handlePages))

	mux.HandleFunc("/api/jadwal", requireAuth(handleJadwal))
	mux.HandleFunc("/api/jadwal/entry", requireAuth(handleJadwalEntry))
	mux.HandleFunc("/api/jadwal/day-toggle", requireAuth(handleJadwalDayToggle))
	mux.HandleFunc("/api/jadwal/reset", requireAuth(handleJadwalReset))

	mux.HandleFunc("/api/tones", requireAuth(handleTones))
	mux.HandleFunc("/api/tones/upload", requireAuth(handleTonesUpload))
	mux.HandleFunc("/api/tones/delete", requireAuth(handleTonesDelete))
	mux.HandleFunc("/api/tones/rename", requireAuth(handleTonesRename))
	mux.HandleFunc("/api/tones/preview", requireAuth(handleTonesPreview))
	mux.HandleFunc("/api/tones/stop", requireAuth(handleTonesStop))
	mux.HandleFunc("/api/tones/", requireAuth(handleTonesFile))

	mux.HandleFunc("/api/config", requireAuth(handleConfig))
	mux.HandleFunc("/api/volume", requireAuth(handleVolume))
	mux.HandleFunc("/api/equalizer", requireAuth(handleEqualizer))

	mux.HandleFunc("/api/libur", requireAuth(handleLibur))
	mux.HandleFunc("/api/libur/nasional", requireAuth(handleLiburNasional))

	mux.HandleFunc("/api/log", requireAuth(handleLog))
	mux.HandleFunc("/api/log/reset", requireAuth(handleLogReset))

	mux.HandleFunc("/api/backup", requireAuth(handleBackup))
	mux.HandleFunc("/api/restore", requireAuth(handleRestore))

	mux.HandleFunc("/api/service/status", requireAuth(handleServiceStatus))
	mux.HandleFunc("/api/service/toggle", requireAuth(handleServiceToggle))

	mux.HandleFunc("/api/change-password", requireAuth(handleChangePassword))
}
