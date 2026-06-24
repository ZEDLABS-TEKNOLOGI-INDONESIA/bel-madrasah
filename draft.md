# SOURCE CODE

## astro.config.mjs
```js
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const BACKEND_URL = process.env.BEL_BACKEND_URL ?? "http://localhost:8082";

export default defineConfig({
  integrations: [react()],
  build: {
    format: "file",
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        "/api": {
          target: BACKEND_URL,
          changeOrigin: true,
        },
        "/login": {
          target: BACKEND_URL,
          changeOrigin: true,
        },
        "/logout": {
          target: BACKEND_URL,
          changeOrigin: true,
        },
        "/healthz": {
          target: BACKEND_URL,
          changeOrigin: true,
        },
      },
    },
  },
});

```
---

## auth.go
```go
package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	usersFile       = dataDir + "/users.json"
	sessionTimeout  = 8 * time.Hour
	cookieName      = "bel_session"
	maxLoginFails   = 5
	loginLockout    = 15 * time.Minute
	bcryptCost      = bcrypt.DefaultCost
	sessionCleanInt = 30 * time.Minute
)

type User struct {
	Username     string `json:"username"`
	PasswordHash string `json:"password_hash"`
}

type Session struct {
	Username  string
	ExpiresAt time.Time
}

type loginAttempt struct {
	count     int
	lockUntil time.Time
}

var (
	sessions   = make(map[string]*Session)
	sessionsMu sync.RWMutex

	loginAttempts   = make(map[string]*loginAttempt)
	loginAttemptsMu sync.Mutex
)

func hashPassword(p string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(p), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(h), nil
}

func verifyPassword(hash, p string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(p)) == nil
}

func initAuth() error {
	if _, err := os.Stat(usersFile); os.IsNotExist(err) {
		hash, err := hashPassword("P@ssw0rd")
		if err != nil {
			return err
		}
		u := User{Username: "administrator", PasswordHash: hash}
		data, err := json.MarshalIndent(u, "", "  ")
		if err != nil {
			return err
		}
		if err := os.WriteFile(usersFile, data, 0600); err != nil {
			return err
		}
		logMsg("akun administrator default dibuat — username: administrator | password: P@ssw0rd")
		logMsg("segera ganti password melalui halaman pengaturan")
	}
	go cleanupSessions()
	return nil
}

func cleanupSessions() {
	ticker := time.NewTicker(sessionCleanInt)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()

		sessionsMu.Lock()
		for token, s := range sessions {
			if now.After(s.ExpiresAt) {
				delete(sessions, token)
			}
		}
		sessionsMu.Unlock()

		loginAttemptsMu.Lock()
		for ip, a := range loginAttempts {

			if now.After(a.lockUntil) {
				delete(loginAttempts, ip)
			}
		}
		loginAttemptsMu.Unlock()
	}
}

func loadUser() (*User, error) {
	data, err := os.ReadFile(usersFile)
	if err != nil {
		return nil, err
	}
	var u User
	if err := json.Unmarshal(data, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

func saveUser(u *User) error {
	data, err := json.MarshalIndent(u, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(usersFile, data, 0600)
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func createSession(username string) (string, error) {
	token, err := generateToken()
	if err != nil {
		return "", err
	}
	sessionsMu.Lock()
	sessions[token] = &Session{
		Username:  username,
		ExpiresAt: time.Now().Add(sessionTimeout),
	}
	sessionsMu.Unlock()
	return token, nil
}

func getSession(r *http.Request) *Session {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return nil
	}
	sessionsMu.RLock()
	s, ok := sessions[c.Value]
	sessionsMu.RUnlock()
	if !ok || time.Now().After(s.ExpiresAt) {
		return nil
	}
	return s
}

func clientIP(r *http.Request) string {
	if os.Getenv("BEL_TRUST_PROXY") == "1" {
		if xf := r.Header.Get("X-Forwarded-For"); xf != "" {
			parts := strings.Split(xf, ",")
			if ip := strings.TrimSpace(parts[0]); ip != "" {
				return ip
			}
		}
		if xr := r.Header.Get("X-Real-IP"); xr != "" {
			return strings.TrimSpace(xr)
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func isLoginLocked(ip string) (bool, time.Duration) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	a, ok := loginAttempts[ip]
	if !ok {
		return false, 0
	}
	if a.count >= maxLoginFails && time.Now().Before(a.lockUntil) {
		return true, time.Until(a.lockUntil)
	}
	return false, 0
}

func recordLoginFailure(ip string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	a, ok := loginAttempts[ip]
	if !ok {
		a = &loginAttempt{}
		loginAttempts[ip] = a
	}
	a.count++
	if a.count >= maxLoginFails {
		a.lockUntil = time.Now().Add(loginLockout)
	}
}

func resetLoginFailures(ip string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	delete(loginAttempts, ip)
}

func isJSONRequest(r *http.Request) bool {
	return strings.Contains(r.Header.Get("Accept"), "application/json") ||
		strings.Contains(r.Header.Get("Content-Type"), "application/json")
}

func requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if getSession(r) == nil {
			if isJSONRequest(r) {
				jsonError(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}
		next(w, r)
	}
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	fmt.Fprintf(w, `{"error":%q}`, msg)
}

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

```
---

## .env
```bash
BEL_TLS=0
BEL_TRUST_PROXY=0
BEL_ORIGINS=http://localhost:4321,http://localhost:3000,http://0.0.0.0:4321
BEL_ALSA_DEVICE=hw:1,0

```
---

## go.mod
```go
module bel-madrasah

go 1.21

require golang.org/x/crypto v0.33.0

```
---

## go.sum
```text
golang.org/x/crypto v0.33.0 h1:IOBPskki6Lysi0lo9qQvbxiQ+FvsCC/YWOecCHAixus=
golang.org/x/crypto v0.33.0/go.mod h1:bVdXmD7IV/4GdElGPozy6U7lWdRXA4qyRVGJV57uQ5M=

```
---

## handler.go
```go
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

var validModes = map[string]bool{
	"reguler":   true,
	"ramadhan":  true,
	"pts":       true,
	"pas":       true,
	"pesantren": true,
	"lainnya":   true,
}

var secureCookie = os.Getenv("BEL_TLS") == "1"

var pageRoutes = map[string]string{
	"/":         "index.html",
	"/jadwal":   "jadwal.html",
	"/audio":    "audio.html",
	"/libur":    "libur.html",
	"/log":      "log.html",
	"/settings": "settings.html",
}

func isValidAudioPath(p string) bool {
	clean := filepath.Clean(p)
	sep := string(filepath.Separator)
	return clean == toneDir || strings.HasPrefix(clean, toneDir+sep)
}

func registerRoutes(mux *http.ServeMux) {
	registerPWARoutes(mux)

	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))
	mux.Handle("/_astro/", http.FileServer(http.Dir(staticDir)))

	for _, name := range []string{"favicon.svg", "favicon.ico", "manifest.json", "robots.txt"} {
		serveFile := filepath.Join(staticDir, name)
		mux.HandleFunc("/"+name, func(w http.ResponseWriter, r *http.Request) {
			http.ServeFile(w, r, serveFile)
		})
	}

	mux.HandleFunc("/healthz", handleHealth)
	mux.HandleFunc("/login", handleLogin)
	mux.HandleFunc("/logout", handleLogout)
	mux.HandleFunc("/", requireAuth(handlePages))

	mux.HandleFunc("/api/jadwal", requireAuth(handleJadwal))
	mux.HandleFunc("/api/jadwal/entry", requireAuth(handleJadwalEntry))
	mux.HandleFunc("/api/jadwal/day-toggle", requireAuth(handleJadwalDayToggle))

	mux.HandleFunc("/api/tones", requireAuth(handleTones))
	mux.HandleFunc("/api/tones/upload", requireAuth(handleTonesUpload))
	mux.HandleFunc("/api/tones/delete", requireAuth(handleTonesDelete))
	mux.HandleFunc("/api/tones/preview", requireAuth(handleTonesPreview))
	mux.HandleFunc("/api/tones/stop", requireAuth(handleTonesStop))
	mux.HandleFunc("/api/tones/", requireAuth(handleTonesFile))

	mux.HandleFunc("/api/config", requireAuth(handleConfig))
	mux.HandleFunc("/api/volume", requireAuth(handleVolume))

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

func methodNotAllowed(w http.ResponseWriter) {
	jsonError(w, "method tidak diizinkan", http.StatusMethodNotAllowed)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

func handlePages(w http.ResponseWriter, r *http.Request) {
	if file, ok := pageRoutes[r.URL.Path]; ok {
		http.ServeFile(w, r, filepath.Join(staticDir, file))
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

func handleLogin(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		if getSession(r) != nil {
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}
		http.ServeFile(w, r, filepath.Join(staticDir, "login.html"))

	case http.MethodPost:
		ip := clientIP(r)
		if locked, remaining := isLoginLocked(ip); locked {
			mins := int(remaining.Minutes()) + 1
			jsonError(w,
				fmt.Sprintf("terlalu banyak percobaan gagal, coba lagi dalam %d menit", mins),
				http.StatusTooManyRequests)
			return
		}

		var body struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonError(w, "request tidak valid", http.StatusBadRequest)
			return
		}
		body.Username = strings.TrimSpace(body.Username)

		user, err := loadUser()
		if err != nil {
			jsonError(w, "gagal memuat data user", http.StatusInternalServerError)
			return
		}
		if body.Username != user.Username || !verifyPassword(user.PasswordHash, body.Password) {
			recordLoginFailure(ip)
			jsonError(w, "username atau password salah", http.StatusUnauthorized)
			return
		}

		resetLoginFailures(ip)
		token, err := createSession(body.Username)
		if err != nil {
			jsonError(w, "gagal membuat sesi", http.StatusInternalServerError)
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name:     cookieName,
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			Secure:   secureCookie,
			SameSite: http.SameSiteLaxMode,
			Expires:  time.Now().Add(sessionTimeout),
		})
		jsonOK(w, map[string]string{"message": "login berhasil"})

	default:
		methodNotAllowed(w)
	}
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie(cookieName)
	if err == nil {
		sessionsMu.Lock()
		delete(sessions, c.Value)
		sessionsMu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secureCookie,
		Expires:  time.Unix(0, 0),
	})
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

func handleChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if len(body.NewPassword) < 8 {
		jsonError(w, "password baru minimal 8 karakter", http.StatusBadRequest)
		return
	}
	user, err := loadUser()
	if err != nil {
		jsonError(w, "gagal memuat data user", http.StatusInternalServerError)
		return
	}
	if !verifyPassword(user.PasswordHash, body.OldPassword) {
		jsonError(w, "password lama salah", http.StatusUnauthorized)
		return
	}
	hash, err := hashPassword(body.NewPassword)
	if err != nil {
		jsonError(w, "gagal mengenkripsi password", http.StatusInternalServerError)
		return
	}
	user.PasswordHash = hash
	if err := saveUser(user); err != nil {
		jsonError(w, "gagal menyimpan password", http.StatusInternalServerError)
		return
	}
	logMsg("password administrator diubah")
	jsonOK(w, map[string]string{"message": "password berhasil diubah"})
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		cfg, err := loadConfig()
		if err != nil {
			jsonError(w, "gagal memuat config", http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]any{
			"config":      cfg,
			"active_mode": resolveMode(cfg),
			"is_libur":    isLibur(cfg),
			"is_playing":  isAudioPlaying(),
			"now_playing": getNowPlaying(),
			"all_modes":   AllModes,
			"all_hari":    AllHari,
		})

	case http.MethodPost:
		var body Config
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonError(w, "request tidak valid", http.StatusBadRequest)
			return
		}
		if !validModes[body.Mode] {
			jsonError(w, "mode tidak valid", http.StatusBadRequest)
			return
		}

		existing, _ := loadConfig()
		body.LiburDates = existing.LiburDates
		if body.DisabledDays == nil {
			body.DisabledDays = existing.DisabledDays
		}
		if body.Volume <= 0 || body.Volume > 2 {
			body.Volume = existing.Volume
		}

		if err := saveConfig(body); err != nil {
			jsonError(w, "gagal menyimpan config", http.StatusInternalServerError)
			return
		}
		logMsg(fmt.Sprintf("config diperbarui: mode=%s override=%v", body.Mode, body.ManualOverride))
		jsonOK(w, map[string]string{"message": "config berhasil disimpan"})

	default:
		methodNotAllowed(w)
	}
}

func handleVolume(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		cfg, err := loadConfig()
		if err != nil {
			jsonError(w, "gagal memuat config", http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]any{"volume": cfg.Volume})

	case http.MethodPost:
		var body struct {
			Volume float64 `json:"volume"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonError(w, "request tidak valid", http.StatusBadRequest)
			return
		}
		if body.Volume < 0 || body.Volume > 2 {
			jsonError(w, "volume harus antara 0.0 dan 2.0", http.StatusBadRequest)
			return
		}
		cfg, err := loadConfig()
		if err != nil {
			jsonError(w, "gagal memuat config", http.StatusInternalServerError)
			return
		}
		cfg.Volume = body.Volume
		if err := saveConfig(cfg); err != nil {
			jsonError(w, "gagal menyimpan volume", http.StatusInternalServerError)
			return
		}
		logMsg(fmt.Sprintf("volume diubah: %.2f", body.Volume))
		jsonOK(w, map[string]string{"message": "volume berhasil disimpan"})

	default:
		methodNotAllowed(w)
	}
}

func handleLibur(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		cfg, err := loadConfig()
		if err != nil {
			jsonError(w, "gagal memuat config", http.StatusInternalServerError)
			return
		}
		dates := cfg.LiburDates
		if dates == nil {
			dates = []LiburDate{}
		}
		sort.Slice(dates, func(i, j int) bool {
			return dates[i].Date < dates[j].Date
		})
		jsonOK(w, map[string]any{"libur": dates})

	case http.MethodPost:
		var body struct {
			Action     string `json:"action"`
			Date       string `json:"date"`
			Keterangan string `json:"keterangan"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonError(w, "request tidak valid", http.StatusBadRequest)
			return
		}
		if _, err := time.Parse("2006-01-02", body.Date); err != nil {
			jsonError(w, "format tanggal tidak valid (YYYY-MM-DD)", http.StatusBadRequest)
			return
		}
		body.Keterangan = strings.TrimSpace(body.Keterangan)

		cfg, err := loadConfig()
		if err != nil {
			jsonError(w, "gagal memuat config", http.StatusInternalServerError)
			return
		}

		switch body.Action {
		case "add":
			for _, d := range cfg.LiburDates {
				if d.Date == body.Date {
					jsonError(w, "tanggal sudah ada", http.StatusBadRequest)
					return
				}
			}
			cfg.LiburDates = append(cfg.LiburDates, LiburDate{
				Date:       body.Date,
				Keterangan: body.Keterangan,
			})
			logMsg(fmt.Sprintf("libur ditambahkan: %s (%s)", body.Date, body.Keterangan))

		case "delete":
			n := cfg.LiburDates[:0]
			for _, d := range cfg.LiburDates {
				if d.Date != body.Date {
					n = append(n, d)
				}
			}
			cfg.LiburDates = n
			logMsg("libur dihapus: " + body.Date)

		default:
			jsonError(w, "action tidak valid", http.StatusBadRequest)
			return
		}

		if err := saveConfig(cfg); err != nil {
			jsonError(w, "gagal menyimpan config", http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]string{"message": "berhasil"})

	default:
		methodNotAllowed(w)
	}
}

func handleLiburNasional(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	year := r.URL.Query().Get("year")
	if year == "" {
		year = strconv.Itoa(time.Now().Year())
	}
	if _, err := strconv.Atoi(year); err != nil {
		jsonError(w, "tahun tidak valid", http.StatusBadRequest)
		return
	}

	apiURL := "https://libur.deno.dev/api?year=" + year
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(apiURL)
	if err != nil {
		jsonError(w, "gagal mengambil data libur nasional", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		jsonError(w, "gagal membaca response", http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(body)
}

func handleJadwal(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	mode := r.URL.Query().Get("mode")
	if !validModes[mode] {
		mode = "reguler"
	}

	j, err := loadJadwal()
	if err != nil {
		jsonError(w, "gagal memuat jadwal", http.StatusInternalServerError)
		return
	}
	cfg, _ := loadConfig()

	mj := j[mode]
	if mj == nil {
		mj = map[string][]Entry{}
	}
	disabledDays := cfg.DisabledDays[mode]
	if disabledDays == nil {
		disabledDays = []string{}
	}

	orderedJadwal := make(map[string][]Entry)
	for _, h := range AllHari {
		entries := mj[h]
		if entries == nil {
			entries = []Entry{}
		}
		orderedJadwal[h] = entries
	}

	jsonOK(w, map[string]any{
		"jadwal":        orderedJadwal,
		"hari":          AllHari,
		"mode":          mode,
		"disabled_days": disabledDays,
	})
}

func handleJadwalDayToggle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		Mode    string `json:"mode"`
		Hari    string `json:"hari"`
		Disable bool   `json:"disable"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if !validModes[body.Mode] {
		jsonError(w, "mode tidak valid", http.StatusBadRequest)
		return
	}
	validHari := false
	for _, h := range AllHari {
		if h == body.Hari {
			validHari = true
			break
		}
	}
	if !validHari {
		jsonError(w, "hari tidak valid", http.StatusBadRequest)
		return
	}

	cfg, err := loadConfig()
	if err != nil {
		jsonError(w, "gagal memuat config", http.StatusInternalServerError)
		return
	}
	if cfg.DisabledDays == nil {
		cfg.DisabledDays = map[string][]string{}
	}

	days := cfg.DisabledDays[body.Mode]
	if body.Disable {
		found := false
		for _, d := range days {
			if d == body.Hari {
				found = true
				break
			}
		}
		if !found {
			days = append(days, body.Hari)
		}
	} else {
		filtered := days[:0]
		for _, d := range days {
			if d != body.Hari {
				filtered = append(filtered, d)
			}
		}
		days = filtered
	}
	cfg.DisabledDays[body.Mode] = days

	if err := saveConfig(cfg); err != nil {
		jsonError(w, "gagal menyimpan config", http.StatusInternalServerError)
		return
	}
	action := "diaktifkan"
	if body.Disable {
		action = "dinonaktifkan"
	}
	logMsg(fmt.Sprintf("hari %s mode %s %s", body.Hari, body.Mode, action))
	jsonOK(w, map[string]string{"message": "berhasil"})
}

func handleJadwalEntry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		Action string `json:"action"`
		Mode   string `json:"mode"`
		Hari   string `json:"hari"`
		Index  int    `json:"index"`
		Entry  Entry  `json:"entry"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if !validModes[body.Mode] {
		jsonError(w, "mode tidak valid", http.StatusBadRequest)
		return
	}

	if body.Action == "add" || body.Action == "edit" {
		if _, err := time.Parse("15:04", body.Entry.Waktu); err != nil {
			jsonError(w, "format waktu tidak valid (HH:MM)", http.StatusBadRequest)
			return
		}
		if body.Entry.Audio == "" {
			jsonError(w, "audio tidak boleh kosong", http.StatusBadRequest)
			return
		}
		cleanAudio := filepath.Clean(body.Entry.Audio)
		if !isValidAudioPath(cleanAudio) {
			jsonError(w, "path audio tidak valid", http.StatusBadRequest)
			return
		}
		body.Entry.Audio = cleanAudio
	}

	j, err := loadJadwal()
	if err != nil {
		jsonError(w, "gagal memuat jadwal", http.StatusInternalServerError)
		return
	}
	if j[body.Mode] == nil {
		jsonError(w, "mode tidak ditemukan", http.StatusNotFound)
		return
	}
	entries, ok := j[body.Mode][body.Hari]
	if !ok {
		jsonError(w, "hari "+body.Hari+" tidak ditemukan", http.StatusNotFound)
		return
	}

	switch body.Action {
	case "add":
		entries = append(entries, body.Entry)
		sort.Slice(entries, func(i, k int) bool { return entries[i].Waktu < entries[k].Waktu })

	case "edit":
		if body.Index < 0 || body.Index >= len(entries) {
			jsonError(w, "index tidak valid", http.StatusBadRequest)
			return
		}
		entries[body.Index] = body.Entry
		sort.Slice(entries, func(i, k int) bool { return entries[i].Waktu < entries[k].Waktu })

	case "delete":
		if body.Index < 0 || body.Index >= len(entries) {
			jsonError(w, "index tidak valid", http.StatusBadRequest)
			return
		}
		entries = append(entries[:body.Index], entries[body.Index+1:]...)

	case "preview":
		if body.Index < 0 || body.Index >= len(entries) {
			jsonError(w, "index tidak valid", http.StatusBadRequest)
			return
		}
		go playSound(entries[body.Index].Audio)
		name := filepath.Base(entries[body.Index].Audio)
		logMsg("preview entry: " + name)
		jsonOK(w, map[string]string{
			"message":  "memutar " + name,
			"filename": name,
			"url":      "/api/tones/" + url.PathEscape(name),
		})
		return

	case "stop":
		stopAllProcs()
		jsonOK(w, map[string]string{"message": "audio dihentikan"})
		return

	default:
		jsonError(w, "action tidak valid", http.StatusBadRequest)
		return
	}

	j[body.Mode][body.Hari] = entries
	if err := saveJadwal(j); err != nil {
		jsonError(w, "gagal menyimpan jadwal", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"message": "berhasil"})
}

func handleTones(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}

	page, perPage := 1, 20
	if p := r.URL.Query().Get("page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			page = n
		}
	}
	if pp := r.URL.Query().Get("per_page"); pp != "" {
		if n, err := strconv.Atoi(pp); err == nil && n > 0 && n <= 500 {
			perPage = n
		}
	}

	files, err := listTones()
	if err != nil {
		jsonError(w, "gagal membaca direktori tone", http.StatusInternalServerError)
		return
	}

	total := len(files)
	start := (page - 1) * perPage
	end := start + perPage
	if start > total {
		start = total
	}
	if end > total {
		end = total
	}

	jsonOK(w, map[string]any{
		"tones":    files[start:end],
		"total":    total,
		"page":     page,
		"per_page": perPage,
		"pages":    max1((total + perPage - 1) / perPage),
	})
}

func max1(a int) int {
	if a < 1 {
		return 1
	}
	return a
}

func handleTonesFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}

	raw := strings.TrimPrefix(r.URL.Path, "/api/tones/")
	decoded, err := url.PathUnescape(raw)
	if err != nil {
		jsonError(w, "nama file tidak valid", http.StatusBadRequest)
		return
	}
	filename, ok := safeFilename(decoded)
	if !ok {
		jsonError(w, "nama file tidak valid", http.StatusBadRequest)
		return
	}

	ext := strings.ToLower(filepath.Ext(filename))
	if ext != ".mp3" && ext != ".wav" && ext != ".ogg" {
		jsonError(w, "format tidak didukung", http.StatusBadRequest)
		return
	}

	full := filepath.Join(toneDir, filename)
	if _, err := os.Stat(full); os.IsNotExist(err) {
		jsonError(w, "file tidak ditemukan", http.StatusNotFound)
		return
	}

	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	http.ServeFile(w, r, full)
}

func safeFilename(name string) (string, bool) {
	base := filepath.Base(name)
	if base == "." || base == ".." || strings.ContainsAny(base, "/\\") {
		return "", false
	}
	return base, true
}

func handleTonesUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		jsonError(w, "file terlalu besar (maks 32MB)", http.StatusBadRequest)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "gagal membaca file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	filename, ok := safeFilename(header.Filename)
	if !ok {
		jsonError(w, "nama file tidak valid", http.StatusBadRequest)
		return
	}
	ext := strings.ToLower(filepath.Ext(filename))
	if ext != ".mp3" && ext != ".wav" && ext != ".ogg" {
		jsonError(w, "format tidak didukung (mp3, wav, ogg)", http.StatusBadRequest)
		return
	}

	dst, err := os.Create(filepath.Join(toneDir, filename))
	if err != nil {
		jsonError(w, "gagal menyimpan file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		jsonError(w, "gagal menulis file", http.StatusInternalServerError)
		return
	}
	logMsg("audio diupload: " + filename)
	jsonOK(w, map[string]string{"message": "upload berhasil", "filename": filename})
}

func handleTonesDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		Filename string `json:"filename"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	filename, ok := safeFilename(body.Filename)
	if !ok {
		jsonError(w, "nama file tidak valid", http.StatusBadRequest)
		return
	}

	full := filepath.Join(toneDir, filename)
	if _, err := os.Stat(full); os.IsNotExist(err) {
		jsonError(w, "file tidak ditemukan", http.StatusNotFound)
		return
	}
	if err := os.Remove(full); err != nil {
		jsonError(w, "gagal menghapus file", http.StatusInternalServerError)
		return
	}
	logMsg("audio dihapus: " + filename)
	jsonOK(w, map[string]string{"message": "file berhasil dihapus"})
}

func handleTonesPreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		Filename string `json:"filename"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	filename, ok := safeFilename(body.Filename)
	if !ok {
		jsonError(w, "nama file tidak valid", http.StatusBadRequest)
		return
	}

	full := filepath.Join(toneDir, filename)
	if _, err := os.Stat(full); os.IsNotExist(err) {
		jsonError(w, "file tidak ditemukan", http.StatusNotFound)
		return
	}
	go playSound(full)
	logMsg("preview: " + filename)
	jsonOK(w, map[string]string{
		"message":  "memutar " + filename,
		"filename": filename,
		"url":      "/api/tones/" + url.PathEscape(filename),
	})
}

func handleTonesStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	stopAllProcs()
	logMsg("audio dihentikan via web")
	jsonOK(w, map[string]string{"message": "audio dihentikan"})
}

func handleLog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	logs, err := readLog()
	if err != nil {
		jsonError(w, "gagal membaca log", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"logs": logs})
}

func handleLogReset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if err := resetLog(); err != nil {
		jsonError(w, "gagal mereset log", http.StatusInternalServerError)
		return
	}
	logMsg("log direset via web")
	jsonOK(w, map[string]string{"message": "log berhasil direset"})
}

func handleBackup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	j, err := loadJadwal()
	if err != nil {
		jsonError(w, "gagal memuat jadwal", http.StatusInternalServerError)
		return
	}
	data, err := json.MarshalIndent(j, "", "  ")
	if err != nil {
		jsonError(w, "gagal membuat backup", http.StatusInternalServerError)
		return
	}
	fname := "backup-jadwal-" + time.Now().Format("20060102-150405") + ".json"
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename="+fname)
	_, _ = w.Write(data)
}

func handleRestore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	if err := r.ParseMultipartForm(4 << 20); err != nil {
		jsonError(w, "file terlalu besar (maks 4MB)", http.StatusBadRequest)
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "gagal membaca file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, 4<<20))
	if err != nil {
		jsonError(w, "gagal membaca isi file", http.StatusInternalServerError)
		return
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		jsonError(w, "file tidak valid (bukan JSON)", http.StatusBadRequest)
		return
	}

	j := make(ModeJadwal)
	for mode, rm := range raw {
		if !validModes[mode] {
			continue
		}
		var hm map[string][]Entry
		if err := json.Unmarshal(rm, &hm); err != nil {
			jsonError(w, "format mode "+mode+" tidak valid", http.StatusBadRequest)
			return
		}

		for hari, entries := range hm {
			for i, e := range entries {
				if _, err := time.Parse("15:04", e.Waktu); err != nil {
					jsonError(w, fmt.Sprintf("waktu tidak valid pada %s/%s[%d]", mode, hari, i), http.StatusBadRequest)
					return
				}
				clean := filepath.Clean(e.Audio)
				if !isValidAudioPath(clean) {
					jsonError(w, fmt.Sprintf("path audio tidak valid pada %s/%s[%d]", mode, hari, i), http.StatusBadRequest)
					return
				}
				entries[i].Audio = clean
			}
			hm[hari] = entries
		}
		j[mode] = hm
	}

	for _, m := range AllModes {
		if j[m] == nil {
			j[m] = map[string][]Entry{}
		}
		for _, h := range AllHari {
			if j[m][h] == nil {
				j[m][h] = []Entry{}
			}
		}
	}

	if err := saveJadwal(j); err != nil {
		jsonError(w, "gagal menyimpan jadwal", http.StatusInternalServerError)
		return
	}
	logMsg("jadwal direstore dari backup")
	jsonOK(w, map[string]string{"message": "jadwal berhasil direstore"})
}

func handleServiceStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	schedulerMu.Lock()
	running := schedulerRunning
	schedulerMu.Unlock()

	cfg, _ := loadConfig()
	jsonOK(w, map[string]any{
		"running":     running,
		"active_mode": resolveMode(cfg),
		"is_libur":    isLibur(cfg),
		"is_playing":  isAudioPlaying(),
		"now_playing": getNowPlaying(),
		"volume":      cfg.Volume,
	})
}

func handleServiceToggle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	schedulerMu.Lock()
	schedulerRunning = !schedulerRunning
	running := schedulerRunning
	schedulerMu.Unlock()

	state := "dihentikan"
	if running {
		state = "dijalankan"
	}
	logMsg("scheduler " + state + " via web")
	jsonOK(w, map[string]any{
		"running": running,
		"message": "scheduler " + state,
	})
}

```
---

## main.go
```go
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"
)

const (
	port      = ":8082"
	toneDir   = "/opt/bel-madrasah/tone"
	dataDir   = "/opt/bel-madrasah/data"
	staticDir = "/opt/bel-madrasah/static"
	sleepSec  = 20 * time.Second
)

var (
	ffmpegPath string

	activeProcs  []*exec.Cmd
	procMu       sync.Mutex
	nowPlaying   string
	nowPlayingMu sync.Mutex

	schedulerRunning = true
	schedulerMu      sync.Mutex
)

func logMsg(msg string) {
	fmt.Printf("[%s] %s\n", time.Now().Format("2006-01-02 15:04:05"), msg)
}

func getHari() string {
	days := map[time.Weekday]string{
		time.Monday:    "Senin",
		time.Tuesday:   "Selasa",
		time.Wednesday: "Rabu",
		time.Thursday:  "Kamis",
		time.Friday:    "Jumat",
		time.Saturday:  "Sabtu",
		time.Sunday:    "Minggu",
	}
	return days[time.Now().Weekday()]
}

func stopAllProcs() {
	procMu.Lock()
	procs := make([]*exec.Cmd, len(activeProcs))
	copy(procs, activeProcs)
	activeProcs = nil
	procMu.Unlock()

	nowPlayingMu.Lock()
	nowPlaying = ""
	nowPlayingMu.Unlock()

	for _, p := range procs {
		if p != nil && p.Process != nil && p.ProcessState == nil {
			_ = p.Process.Kill()
			_ = p.Wait()
		}
	}
	time.Sleep(150 * time.Millisecond)
}

func alsaDevice() string {
	if d := os.Getenv("BEL_ALSA_DEVICE"); d != "" {
		return d
	}
	return "hw:1,0"
}

func volumeString() string {
	cfg, err := loadConfig()
	if err != nil {
		return "0.85"
	}
	return fmt.Sprintf("%.2f", cfg.Volume)
}

func playSound(filePath string) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		logMsg("file tidak ditemukan: " + filePath)
		return
	}
	stopAllProcs()

	nowPlayingMu.Lock()
	nowPlaying = filePath
	nowPlayingMu.Unlock()

	vol := volumeString()
	cmd := exec.Command(ffmpegPath,
		"-hide_banner", "-loglevel", "error",
		"-i", filePath,
		"-filter:a", "volume="+vol,
		"-f", "alsa", alsaDevice(),
	)
	if err := cmd.Start(); err != nil {
		logMsg("gagal memutar audio: " + err.Error())
		nowPlayingMu.Lock()
		nowPlaying = ""
		nowPlayingMu.Unlock()
		return
	}

	procMu.Lock()
	activeProcs = append(activeProcs, cmd)
	procMu.Unlock()

	go func() {
		_ = cmd.Wait()
		nowPlayingMu.Lock()
		if nowPlaying == filePath {
			nowPlaying = ""
		}
		nowPlayingMu.Unlock()

		procMu.Lock()
		alive := activeProcs[:0]
		for _, p := range activeProcs {
			if p != nil && p.ProcessState == nil {
				alive = append(alive, p)
			}
		}
		activeProcs = alive
		procMu.Unlock()
	}()
}

func isAudioPlaying() bool {
	procMu.Lock()
	defer procMu.Unlock()
	for _, p := range activeProcs {
		if p != nil && p.ProcessState == nil {
			return true
		}
	}
	return false
}

func getNowPlaying() string {
	nowPlayingMu.Lock()
	defer nowPlayingMu.Unlock()
	if nowPlaying == "" {
		return ""
	}
	return filepath.Base(nowPlaying)
}

func sleepOrStop(stop <-chan struct{}, d time.Duration) bool {
	select {
	case <-stop:
		return false
	case <-time.After(d):
		return true
	}
}

func runScheduler(stop <-chan struct{}) {
	logMsg("scheduler dimulai")
	played := make(map[string]bool)
	lastDay := ""
	lastWeeklyClean := time.Now()

	for {
		select {
		case <-stop:
			logMsg("scheduler dihentikan")
			return
		default:
		}

		if time.Since(lastWeeklyClean) >= 7*24*time.Hour {
			if err := resetLog(); err != nil {
				logMsg("gagal auto-cleanup log: " + err.Error())
			} else {
				logMsg("auto-cleanup log mingguan selesai")
			}
			lastWeeklyClean = time.Now()
		}

		schedulerMu.Lock()
		running := schedulerRunning
		schedulerMu.Unlock()

		if !running {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		now := time.Now()
		hari := getHari()

		if hari != lastDay {
			if lastDay != "" {
				played = make(map[string]bool)
			}
			lastDay = hari
		}

		cfg, err := loadConfig()
		if err != nil {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		if isLibur(cfg) {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		mode := resolveMode(cfg)

		if mode == "lainnya" || mode == "pesantren" {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		if isDayDisabled(cfg, mode, hari) {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		jadwal, err := loadJadwal()
		if err != nil {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		mj, ok := jadwal[mode]
		if !ok {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		entries, ok := mj[hari]
		if !ok {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		waktu := now.Format("15:04")
		for _, e := range entries {
			key := mode + "|" + hari + "|" + e.Waktu
			if waktu == e.Waktu && !played[key] {
				logMsg(fmt.Sprintf("[%s] %s [%s]", mode, filepath.Base(e.Audio), e.Waktu))
				go playSound(e.Audio)
				played[key] = true
				writeLog(ActivityLog{
					Time:  now.Format("2006-01-02 15:04:05"),
					Mode:  mode,
					Hari:  hari,
					Waktu: e.Waktu,
					Audio: filepath.Base(e.Audio),
				})
			}
		}

		if !sleepOrStop(stop, sleepSec) {
			return
		}
	}
}

func resolveFfmpeg() string {
	for _, p := range []string{
		"/usr/bin/ffmpeg",
		"/usr/local/bin/ffmpeg",
		"/bin/ffmpeg",
	} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	if p, err := exec.LookPath("ffmpeg"); err == nil {
		return p
	}
	return ""
}

func main() {
	ffmpegPath = resolveFfmpeg()
	if ffmpegPath == "" {
		log.Fatal("ffmpeg tidak ditemukan di sistem")
	}
	logMsg("ffmpeg: " + ffmpegPath)
	logMsg("alsa device: " + alsaDevice())

	for _, d := range []string{toneDir, dataDir, staticDir} {
		if err := os.MkdirAll(d, 0755); err != nil {
			log.Fatalf("gagal membuat direktori %s: %s", d, err)
		}
	}

	if err := initStorage(); err != nil {
		log.Fatalf("gagal inisialisasi storage: %s", err)
	}
	if err := initAuth(); err != nil {
		log.Fatalf("gagal inisialisasi auth: %s", err)
	}

	stopScheduler := make(chan struct{})
	go runScheduler(stopScheduler)

	mux := http.NewServeMux()
	registerRoutes(mux)

	allowedOrigins := trustedOrigins()
	handler := corsMiddleware(allowedOrigins, maxBodyMiddleware(mux))

	srv := &http.Server{
		Addr:              port,
		Handler:           handler,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		logMsg("server berjalan di port " + port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErr <- err
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		log.Fatalf("server error: %s", err)
	case sig := <-sigCh:
		logMsg("menerima sinyal " + sig.String() + ", memulai shutdown")
	}

	close(stopScheduler)
	stopAllProcs()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logMsg("gagal shutdown server: " + err.Error())
	}
	logMsg("server dihentikan")
}

```
---

## middleware.go
```go
package main

import (
	"net/http"
	"os"
	"strings"
)

func trustedOrigins() []string {
	scheme := "http"
	if os.Getenv("BEL_TLS") == "1" {
		scheme = "https"
	}

	if v := os.Getenv("BEL_ORIGINS"); v != "" {
		var origins []string
		for _, o := range strings.Split(v, ",") {
			o = strings.TrimSpace(o)
			if o == "" {
				continue
			}
			if !strings.Contains(o, "://") {
				o = scheme + "://" + o
			}
			origins = append(origins, o)
		}
		return origins
	}

	return []string{
		scheme + "://localhost:4321",
		scheme + "://localhost:3000",
		scheme + "://127.0.0.1:4321",
		scheme + "://0.0.0.0:4321",
	}
}

func corsMiddleware(allowed []string, next http.Handler) http.Handler {
	isAllowed := func(origin string) bool {
		for _, o := range allowed {
			if o == origin {
				return true
			}
		}
		return false
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && isAllowed(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept")
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func maxBodyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 35<<20)
		next.ServeHTTP(w, r)
	})
}

```
---

## package.json
```json
{
  "name": "web",
  "type": "module",
  "version": "0.0.1",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro"
  },
  "dependencies": {
    "@astrojs/react": "^6.0.0",
    "@tailwindcss/vite": "^4.3.1",
    "@tanstack/react-query": "^5.101.0",
    "astro": "^7.0.2",
    "dotenv": "^17.4.2",
    "framer-motion": "^12.40.0",
    "lucide-react": "^1.21.0",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-hot-toast": "^2.6.0",
    "tailwindcss": "^4.3.1"
  },
  "devDependencies": {
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3"
  }
}

```
---

## pnpm-workspace.yaml
```yaml
packages:
  - "."
allowBuilds:
  esbuild: true
  sharp: true
minimumReleaseAgeExclude:
  - '@astrojs/markdown-satteri@0.3.2'
  - astro@7.0.2

```
---

## pwa.go
```go
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

```
---

## src/components/App.tsx
```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import React, { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { queryClient } from "../lib/queryClient";
import { attachListeners, initRouter } from "../lib/router";
import { Shell } from "./layout/Shell";

const DashboardPage = lazy(() =>
  import("./dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const JadwalPage = lazy(() =>
  import("./jadwal/JadwalPage").then((m) => ({ default: m.JadwalPage }))
);
const AudioPage = lazy(() => import("./audio/AudioPage").then((m) => ({ default: m.AudioPage })));
const LiburPage = lazy(() => import("./libur/LiburPage").then((m) => ({ default: m.LiburPage })));
const LogPage = lazy(() => import("./log/LogPage").then((m) => ({ default: m.LogPage })));
const PengaturanPage = lazy(() =>
  import("./pengaturan/PengaturanPage").then((m) => ({ default: m.PengaturanPage }))
);

type Page = "dashboard" | "jadwal" | "audio" | "libur" | "log" | "settings";

const PATH_TO_PAGE: Record<string, Page> = {
  "/": "dashboard",
  "/jadwal": "jadwal",
  "/audio": "audio",
  "/libur": "libur",
  "/log": "log",
  "/settings": "settings",
};

const PAGE_MAP: Record<Page, React.ReactNode> = {
  dashboard: <DashboardPage />,
  jadwal: <JadwalPage />,
  audio: <AudioPage />,
  libur: <LiburPage />,
  log: <LogPage />,
  settings: <PengaturanPage />,
};

export default function App({ page: initialPage }: { page: Page }) {
  const [page, setPage] = useState<Page>(initialPage);

  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    } else if (import.meta.env.DEV && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
    }

    // Init SPA router
    initRouter();

    // Listen untuk navigasi
    const handler = (e: Event) => {
      const path = (e as CustomEvent<{ path: string }>).detail.path;
      const nextPage = PATH_TO_PAGE[path];
      if (nextPage) setPage(nextPage);
    };
    window.addEventListener("spa-navigate", handler);
    return () => window.removeEventListener("spa-navigate", handler);
  }, []);

  // Re-attach listeners setiap render (link baru mungkin muncul)
  useEffect(() => {
    attachListeners();
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Shell>
        <Suspense
          fallback={
            <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>Memuat...</div>
          }
        >
          {PAGE_MAP[page]}
        </Suspense>
      </Shell>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: "var(--font)",
            fontSize: 13,
            background: "var(--card-bg)",
            color: "var(--text)",
            border: "1px solid var(--border)",
          },
        }}
      />
    </QueryClientProvider>
  );
}

```
---

## src/components/audio/AudioPage.tsx
```tsx
import React from "react";
import { VolumeSlider } from "./VolumeSlider";
import { UploadZone } from "./UploadZone";
import { ToneList } from "./ToneList";

export function AudioPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-5">
          <VolumeSlider />
        </div>
        <div className="col-span-12 md:col-span-7">
          <UploadZone />
        </div>
      </div>
      <ToneList />
    </div>
  );
}

```
---

## src/components/audio/ToneList.tsx
```tsx
import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ToneRow } from "./ToneRow";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { SkeletonCard } from "../ui/Skeleton";
import { useTones, useDeleteTone } from "../../hooks/useTones";
import { useAudio } from "../../hooks/useAudio";
import toast from "react-hot-toast";

export function ToneList() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useTones(page, 20);
  const deleteTone = useDeleteTone();
  const { preview, stop, isPlaying } = useAudio();

  const tones: string[] = data?.tones ?? [];
  const totalPages: number = data?.pages ?? 1;
  const total: number = data?.total ?? 0;

  async function handlePlay(filename: string) {
    try {
      await preview(filename, "/api/tones/preview", { filename });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleStop() {
    await stop("/api/tones/stop");
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Hapus ${filename}?`)) return;
    try {
      await deleteTone.mutateAsync(filename);
      toast.success(`${filename} dihapus`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Daftar Audio
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{total} file</span>
      </div>

      {tones.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "32px 0",
            fontSize: 13,
            color: "var(--text-muted)",
            fontStyle: "italic",
          }}
        >
          Belum ada file audio. Upload file di atas.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tones.map((filename) => (
            <ToneRow
              key={filename}
              filename={filename}
              isPlaying={isPlaying(filename)}
              onPlay={() => handlePlay(filename)}
              onStop={handleStop}
              onDelete={() => handleDelete(filename)}
              deleteLoading={deleteTone.isPending}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<ChevronLeft size={14} />}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {page} / {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            icon={<ChevronRight size={14} />}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          />
        </div>
      )}
    </Card>
  );
}

```
---

## src/components/audio/ToneRow.tsx
```tsx
import React from "react";
import { Music2, Play, Square, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";

interface ToneRowProps {
  filename: string;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onDelete: () => void;
  deleteLoading?: boolean;
}

export function ToneRow({
  filename,
  isPlaying,
  onPlay,
  onStop,
  onDelete,
  deleteLoading,
}: ToneRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: "var(--radius)",
        background: isPlaying ? "rgba(9,105,218,0.06)" : "var(--bg-secondary)",
        border: isPlaying ? "1px solid rgba(9,105,218,0.2)" : "1px solid var(--border)",
        transition: "all 0.15s",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: isPlaying ? "rgba(9,105,218,0.12)" : "var(--bg-tertiary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 0.15s",
        }}
      >
        {isPlaying ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="wave-bar" style={{ height: `${6 + i * 2}px` }} />
            ))}
          </div>
        ) : (
          <Music2 size={14} color="var(--text-muted)" />
        )}
      </div>

      <span
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: isPlaying ? 500 : 400,
          color: isPlaying ? "var(--accent)" : "var(--text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {filename}
      </span>

      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {isPlaying ? (
          <Button variant="danger" size="sm" icon={<Square size={12} />} onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button variant="ghost" size="sm" icon={<Play size={12} />} onClick={onPlay}>
            Play
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 size={12} />}
          onClick={onDelete}
          loading={deleteLoading}
          style={{ color: "var(--danger)" }}
        />
      </div>
    </div>
  );
}

```
---

## src/components/audio/UploadZone.tsx
```tsx
import React, { useRef, useState } from "react";
import { Upload, FileAudio, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "../ui/Card";
import { useUploadTone } from "../../hooks/useTones";
import toast from "react-hot-toast";

export function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const upload = useUploadTone();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["mp3", "wav", "ogg"].includes(ext ?? "")) {
      toast.error("Format tidak didukung (mp3, wav, ogg)");
      return;
    }
    if (file.size > 32 * 1024 * 1024) {
      toast.error("File terlalu besar (maks 32MB)");
      return;
    }

    setProgress(0);
    const form = new FormData();
    form.append("file", file);

    const interval = setInterval(() => {
      setProgress((p) => (p != null && p < 85 ? p + 10 : p));
    }, 120);

    try {
      await upload.mutateAsync(form);
      clearInterval(interval);
      setProgress(100);
      toast.success(`${file.name} berhasil diupload`);
      setTimeout(() => setProgress(null), 1500);
    } catch (e: any) {
      clearInterval(interval);
      setProgress(null);
      toast.error(e.message);
    }
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Upload Audio
      </span>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "var(--radius-lg)",
          background: dragging ? "rgba(9,105,218,0.04)" : "var(--bg-secondary)",
          padding: "28px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        {progress === 100 ? (
          <CheckCircle2 size={28} color="var(--success)" />
        ) : upload.isPending ? (
          <FileAudio size={28} color="var(--accent)" />
        ) : (
          <Upload size={28} color={dragging ? "var(--accent)" : "var(--text-muted)"} />
        )}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: dragging ? "var(--accent)" : "var(--text)",
            }}
          >
            {upload.isPending ? "Mengupload..." : "Drag & drop atau klik untuk pilih file"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            MP3, WAV, OGG — maks 32MB
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.wav,.ogg"
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {progress !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            <span>{progress === 100 ? "Selesai" : "Mengupload..."}</span>
            <span>{progress}%</span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 99,
              background: "var(--bg-tertiary)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: progress === 100 ? "var(--success)" : "var(--accent)",
                borderRadius: 99,
                transition: "width 0.12s, background 0.3s",
              }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

```
---

## src/components/audio/VolumeSlider.tsx
```tsx
import React, { useState, useEffect, useRef } from "react";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { Card } from "../ui/Card";
import { Slider } from "../ui/Slider";
import { useVolume, useUpdateVolume } from "../../hooks/useConfig";
import { Skeleton } from "../ui/Skeleton";
import toast from "react-hot-toast";

export function VolumeSlider() {
  const { data, isLoading } = useVolume();
  const update = useUpdateVolume();
  const [local, setLocal] = useState<number>(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data?.volume != null) setLocal(data.volume);
  }, [data?.volume]);

  function handleChange(val: number) {
    setLocal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await update.mutateAsync(val);
        toast.success("Volume disimpan");
      } catch (e: any) {
        toast.error(e.message);
      }
    }, 300);
  }

  function VolumeIcon() {
    if (local === 0) return <VolumeX size={16} color="var(--text-muted)" />;
    if (local < 0.5) return <Volume1 size={16} color="var(--text-muted)" />;
    return <Volume2 size={16} color="var(--text-muted)" />;
  }

  if (isLoading) return <Skeleton height={100} radius="var(--radius-lg)" />;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Volume Output
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <VolumeIcon />
          <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {Math.round(local * 100)}%
          </span>
        </div>
      </div>

      <Slider
        value={local}
        min={0}
        max={2}
        step={0.01}
        onChange={handleChange}
        disabled={update.isPending}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        <span>0%</span>
        <span style={{ color: local > 1 ? "var(--warning)" : "var(--text-muted)" }}>
          {local > 1 ? "Amplifikasi aktif" : "100% = volume normal"}
        </span>
        <span>200%</span>
      </div>
    </Card>
  );
}

```
---

## src/components/auth/LoginPage.tsx
```tsx
import React, { useState } from "react";
import { Music2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      localStorage.getItem("theme") ??
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    );
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/login", { username, password });
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "var(--card-gloss), var(--card-bg)",
          border: "1px solid var(--card-border)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          boxShadow: "var(--card-shadow)",
          borderRadius: "var(--radius-xl)",
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Music2 size={24} color="#fff" />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Bel Madrasah</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              Masuk untuk melanjutkan
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div
              style={{
                fontSize: 12,
                color: "var(--danger)",
                background: "rgba(207,34,46,0.08)",
                border: "1px solid rgba(207,34,46,0.2)",
                borderRadius: "var(--radius)",
                padding: "8px 12px",
              }}
            >
              {error}
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            loading={loading}
            style={{ width: "100%", marginTop: 4 }}
          >
            Masuk
          </Button>
        </form>
      </div>
    </div>
  );
}

```
---

## src/components/dashboard/DashboardPage.tsx
```tsx
import React from "react";
import { StatusCard } from "./StatusCard";
import { ModeCard } from "./ModeCard";
import { NowPlayingCard } from "./NowPlayingCard";
import { QuickActions } from "./QuickActions";

export function DashboardPage() {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 md:col-span-7">
        <StatusCard />
      </div>
      <div className="col-span-12 md:col-span-5">
        <ModeCard />
      </div>
      <div className="col-span-12 md:col-span-4">
        <NowPlayingCard />
      </div>
      <div className="col-span-12 md:col-span-8">
        <QuickActions />
      </div>
    </div>
  );
}

```
---

## src/components/dashboard/ModeCard.tsx
```tsx
import React, { useState } from "react";
import { Settings2, ChevronRight } from "lucide-react";
import { useConfig, useUpdateConfig } from "../../hooks/useConfig";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import toast from "react-hot-toast";

const MODE_LABELS: Record<string, string> = {
  reguler: "Reguler",
  ramadhan: "Ramadhan",
  pts: "PTS",
  pas: "PAS",
  pesantren: "Pesantren",
  lainnya: "Lainnya",
};

const ALL_MODES = ["reguler", "ramadhan", "pts", "pas", "pesantren", "lainnya"];

export function ModeCard() {
  const { data, isLoading } = useConfig();
  const update = useUpdateConfig();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(null);

  function openModal() {
    if (!data?.config) return;
    setForm({ ...data.config });
    setOpen(true);
  }

  async function handleSave() {
    try {
      await update.mutateAsync(form);
      toast.success("Config berhasil disimpan");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) return <Skeleton height={120} radius="var(--radius-lg)" />;

  const cfg = data?.config;
  const activeMode = data?.active_mode ?? "-";

  return (
    <>
      <Card
        hover
        onClick={openModal}
        style={{ display: "flex", flexDirection: "column", gap: 14, cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Mode Bel
          </span>
          <ChevronRight size={14} color="var(--text-muted)" />
        </div>
        <div>
          <Badge variant="accent" dot>
            {MODE_LABELS[activeMode] ?? activeMode}
          </Badge>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {["ramadhan", "pts", "pas", "pesantren"].map((m) => {
            const start = cfg?.[`${m}_start`];
            const end = cfg?.[`${m}_end`];
            if (!start && !end) return null;
            return (
              <div
                key={m}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "var(--text-muted)",
                }}
              >
                <span style={{ fontWeight: 500 }}>{MODE_LABELS[m]}</span>
                <span>
                  {start} – {end}
                </span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Settings2 size={11} /> Klik untuk ubah config
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Konfigurasi Mode Bel" width={520}>
        {form && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
                Mode
              </label>
              <select
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value })}
              >
                {ALL_MODES.map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                id="manual-override"
                checked={form.manual_override ?? false}
                onChange={(e) => setForm({ ...form, manual_override: e.target.checked })}
                style={{ width: "auto" }}
              />
              <label htmlFor="manual-override" style={{ fontSize: 13, cursor: "pointer" }}>
                Manual Override (paksa gunakan mode di atas)
              </label>
            </div>

            {[
              { key: "ramadhan", label: "Ramadhan" },
              { key: "pts", label: "PTS" },
              { key: "pas", label: "PAS" },
              { key: "pesantren", label: "Pesantren" },
            ].map(({ key, label }) => (
              <div key={key}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    marginBottom: 8,
                  }}
                >
                  {label}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Mulai</label>
                    <input
                      type="date"
                      value={form[`${key}_start`] ?? ""}
                      onChange={(e) => setForm({ ...form, [`${key}_start`]: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Selesai</label>
                    <input
                      type="date"
                      value={form[`${key}_end`] ?? ""}
                      onChange={(e) => setForm({ ...form, [`${key}_end`]: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button variant="primary" loading={update.isPending} onClick={handleSave}>
                Simpan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

```
---

## src/components/dashboard/NowPlayingCard.tsx
```tsx
import React from "react";
import { Square } from "lucide-react";
import { useServiceStatus } from "../../hooks/useConfig";
import { api } from "../../lib/api";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { Button } from "../ui/Button";
import toast from "react-hot-toast";

export function NowPlayingCard() {
  const { data, isLoading, refetch } = useServiceStatus();

  async function handleStop() {
    try {
      await api.post("/api/tones/stop", {});
      toast.success("Audio dihentikan");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) return <Skeleton height={100} radius="var(--radius-lg)" />;

  const isPlaying = data?.is_playing;
  const nowPlaying = data?.now_playing;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Now Playing
      </span>
      {isPlaying ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 20, flexShrink: 0 }}
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="wave-bar" style={{ height: `${8 + i * 2}px` }} />
              ))}
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {nowPlaying || "Audio"}
            </span>
          </div>
          <Button variant="danger" size="sm" icon={<Square size={12} />} onClick={handleStop}>
            Stop
          </Button>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
          Tidak ada audio yang diputar
        </div>
      )}
    </Card>
  );
}

```
---

## src/components/dashboard/QuickActions.tsx
```tsx
import React from "react";
import { Play, Square, CalendarDays, Upload } from "lucide-react";
import { useServiceStatus, useServiceToggle } from "../../hooks/useConfig";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import toast from "react-hot-toast";

export function QuickActions() {
  const { data, isLoading } = useServiceStatus();
  const toggle = useServiceToggle();

  async function handleToggle() {
    try {
      await toggle.mutateAsync();
      toast.success(data?.running ? "Scheduler dihentikan" : "Scheduler dijalankan");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) return <Skeleton height={80} radius="var(--radius-lg)" />;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        Quick Actions
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        <Button
          variant={data?.running ? "danger" : "primary"}
          icon={data?.running ? <Square size={14} /> : <Play size={14} />}
          loading={toggle.isPending}
          onClick={handleToggle}
        >
          {data?.running ? "Stop Scheduler" : "Start Scheduler"}
        </Button>
        <Button
          variant="secondary"
          icon={<CalendarDays size={14} />}
          onClick={() => (window.location.href = "/jadwal")}
        >
          Buka Jadwal
        </Button>
        <Button
          variant="secondary"
          icon={<Upload size={14} />}
          onClick={() => (window.location.href = "/audio")}
        >
          Upload Audio
        </Button>
      </div>
    </Card>
  );
}

```
---

## src/components/dashboard/StatusCard.tsx
```tsx
import { Volume2 } from "lucide-react";
import toast from "react-hot-toast";
import { useServiceStatus, useServiceToggle } from "../../hooks/useConfig";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { Toggle } from "../ui/Toggle";

export function StatusCard() {
  const { data, isLoading } = useServiceStatus();
  const toggle = useServiceToggle();

  async function handleToggle() {
    try {
      await toggle.mutateAsync();
      toast.success(data?.running ? "Scheduler dihentikan" : "Scheduler dijalankan");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) return <Skeleton height={120} radius="var(--radius-lg)" />;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Status Scheduler
        </span>
        <Toggle
          checked={data?.running ?? false}
          onChange={handleToggle}
          disabled={toggle.isPending}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Status</span>
          <Badge variant={data?.running ? "success" : "danger"} dot>
            {data?.running ? "Berjalan" : "Dihentikan"}
          </Badge>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Mode Aktif</span>
          <Badge variant="accent">{data?.active_mode ?? "-"}</Badge>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Hari Libur</span>
          <Badge variant={data?.is_libur ? "warning" : "default"}>
            {data?.is_libur ? "Libur" : "Aktif"}
          </Badge>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Volume2 size={13} /> Volume
          </span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            {data?.volume != null ? `${Math.round(data.volume * 100)}%` : "-"}
          </span>
        </div>
      </div>
    </Card>
  );
}

```
---

## src/components/jadwal/EntryModal.tsx
```tsx
import { useEffect, useState } from "react";
import { useTones } from "../../hooks/useTones";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface Entry {
  waktu: string;
  audio: string;
}

interface EntryModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (entry: Entry) => void;
  initial?: Entry | null;
  loading?: boolean;
  toneDir?: string;
}

export function EntryModal({
  open,
  onClose,
  onSave,
  initial,
  loading,
  toneDir = "/opt/bel-madrasah/tone",
}: EntryModalProps) {
  const [waktu, setWaktu] = useState("");
  const [selectedFilename, setSelectedFilename] = useState("");
  const { data: tonesData } = useTones(1, 500);

  useEffect(() => {
    if (!open) return;
    setWaktu(initial?.waktu ?? "");
    if (initial?.audio) {
      const filename = initial.audio.split("/").pop() ?? "";
      setSelectedFilename(filename);
    } else {
      setSelectedFilename("");
    }
  }, [open, initial]);

  function buildFullPath(filename: string) {
    if (!filename) return "";
    return `${toneDir}/${filename}`;
  }

  function handleSave() {
    if (!waktu || !selectedFilename) return;
    onSave({ waktu, audio: buildFullPath(selectedFilename) });
  }

  const tones: string[] = tonesData?.tones ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit Entry Jadwal" : "Tambah Entry Jadwal"}
      width={420}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Waktu (HH:MM)
          </label>
          <input type="time" value={waktu} onChange={(e) => setWaktu(e.target.value)} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Audio</label>
          <select value={selectedFilename} onChange={(e) => setSelectedFilename(e.target.value)}>
            <option value="">-- Pilih audio --</option>
            {tones.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {selectedFilename && (
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                padding: "4px 8px",
                background: "var(--bg-tertiary)",
                borderRadius: "var(--radius)",
                fontFamily: "monospace",
                wordBreak: "break-all",
              }}
            >
              {buildFullPath(selectedFilename)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            loading={loading}
            disabled={!waktu || !selectedFilename}
            onClick={handleSave}
          >
            Simpan
          </Button>
        </div>
      </div>
    </Modal>
  );
}

```
---

## src/components/jadwal/EntryRow.tsx
```tsx
import React from "react";
import { Play, Square, Pencil, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";

interface Entry {
  waktu: string;
  audio: string;
}

interface EntryRowProps {
  entry: Entry;
  index: number;
  disabled: boolean;
  isPlaying: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPlay: () => void;
  onStop: () => void;
}

export function EntryRow({
  entry,
  disabled,
  isPlaying,
  onEdit,
  onDelete,
  onPlay,
  onStop,
}: EntryRowProps) {
  const filename = entry.audio.split("/").pop() ?? entry.audio;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: "var(--radius)",
        background: isPlaying ? "rgba(9,105,218,0.06)" : "var(--bg-secondary)",
        border: isPlaying ? "1px solid rgba(9,105,218,0.2)" : "1px solid var(--border)",
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.15s",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: isPlaying ? "var(--accent)" : "var(--text)",
          minWidth: 44,
          flexShrink: 0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {entry.waktu}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
        {isPlaying && (
          <div
            style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 14, flexShrink: 0 }}
          >
            {[1, 2, 3].map((i) => (
              <div key={i} className="wave-bar" style={{ height: `${6 + i * 2}px` }} />
            ))}
          </div>
        )}
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {filename}
        </span>
      </div>

      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {isPlaying ? (
          <Button
            variant="danger"
            size="sm"
            icon={<Square size={12} />}
            onClick={onStop}
            disabled={disabled}
          >
            Stop
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            icon={<Play size={12} />}
            onClick={onPlay}
            disabled={disabled}
          >
            Play
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={<Pencil size={12} />}
          onClick={onEdit}
          disabled={disabled}
        />
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 size={12} />}
          onClick={onDelete}
          disabled={disabled}
          style={{ color: "var(--danger)" }}
        />
      </div>
    </div>
  );
}

```
---

## src/components/jadwal/HariSection.tsx
```tsx
import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useDayToggle, useJadwalEntry } from "../../hooks/useJadwal";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Toggle";
import { EntryModal } from "./EntryModal";
import { EntryRow } from "./EntryRow";

interface Entry {
  waktu: string;
  audio: string;
}

interface HariSectionProps {
  mode: string;
  hari: string;
  entries: Entry[];
  disabled: boolean;
  toneDir: string;
}

export function HariSection({ mode, hari, entries, disabled, toneDir }: HariSectionProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<{ entry: Entry; index: number } | null>(null);
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const entryMutation = useJadwalEntry();
  const dayToggle = useDayToggle();

  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  async function handleSave(entry: Entry) {
    try {
      if (editEntry !== null) {
        await entryMutation.mutateAsync({
          action: "edit",
          mode,
          hari,
          index: editEntry.index,
          entry,
        });
        toast.success("Entry diperbarui");
      } else {
        await entryMutation.mutateAsync({ action: "add", mode, hari, entry });
        toast.success("Entry ditambahkan");
      }
      setModalOpen(false);
      setEditEntry(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(index: number) {
    try {
      await entryMutation.mutateAsync({ action: "delete", mode, hari, index });
      toast.success("Entry dihapus");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handlePlay(index: number) {
    try {
      const res: any = await api.post("/api/jadwal/entry", {
        action: "preview",
        mode,
        hari,
        index,
      });
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const a = new Audio(res.url);
      audioRef.current = a;
      setPlayingFile(res.filename);
      a.onended = () => setPlayingFile(null);
      a.onerror = () => setPlayingFile(null);
      await a.play();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleStop() {
    try {
      await api.post("/api/tones/stop", {});
    } finally {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingFile(null);
    }
  }

  async function handleToggleDay(val: boolean) {
    try {
      await dayToggle.mutateAsync({ mode, hari, disable: !val });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div
      style={{
        background: "var(--card-gloss), var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          cursor: isMobile ? "pointer" : "default",
          borderBottom: open ? "1px solid var(--border)" : "none",
        }}
        onClick={() => isMobile && setOpen((v) => !v)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{hari}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{entries.length} entry</span>
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Toggle checked={!disabled} onChange={handleToggleDay} disabled={dayToggle.isPending} />
          {isMobile && (
            <ChevronDown
              size={16}
              color="var(--text-muted)"
              style={{
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          )}
        </div>
      </div>

      {open && (
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                fontStyle: "italic",
                textAlign: "center",
                padding: "8px 0",
              }}
            >
              Belum ada entry
            </div>
          ) : (
            entries.map((entry, i) => {
              const filename = entry.audio.split("/").pop() ?? "";
              return (
                <EntryRow
                  key={i}
                  entry={entry}
                  index={i}
                  disabled={disabled}
                  isPlaying={playingFile === filename}
                  onEdit={() => {
                    setEditEntry({ entry, index: i });
                    setModalOpen(true);
                  }}
                  onDelete={() => handleDelete(i)}
                  onPlay={() => handlePlay(i)}
                  onStop={handleStop}
                />
              );
            })
          )}
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => {
              setEditEntry(null);
              setModalOpen(true);
            }}
            style={{ alignSelf: "flex-start", marginTop: 4 }}
          >
            Tambah Entry
          </Button>
        </div>
      )}

      <EntryModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditEntry(null);
        }}
        onSave={handleSave}
        initial={editEntry?.entry ?? null}
        loading={entryMutation.isPending}
        toneDir={toneDir}
      />
    </div>
  );
}

```
---

## src/components/jadwal/JadwalPage.tsx
```tsx
import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ModeTabs } from "./ModeTabs";
import { HariSection } from "./HariSection";
import { useJadwal } from "../../hooks/useJadwal";
import { useConfig } from "../../hooks/useConfig";
import { SkeletonCard } from "../ui/Skeleton";

const ALL_MODES = ["reguler", "ramadhan", "pts", "pas", "pesantren", "lainnya"];
const DEFAULT_TONE_DIR = "/opt/bel-madrasah/tone";

function extractToneDirFromCache(qc: ReturnType<typeof useQueryClient>): string {
  for (const mode of ALL_MODES) {
    const cached: any = qc.getQueryData(["jadwal", mode]);
    if (!cached?.jadwal) continue;
    for (const entries of Object.values(cached.jadwal) as any[]) {
      for (const e of entries) {
        const idx = (e.audio as string).lastIndexOf("/");
        if (idx > 0) return (e.audio as string).substring(0, idx);
      }
    }
  }
  return DEFAULT_TONE_DIR;
}

export function JadwalPage() {
  const [mode, setMode] = useState("reguler");
  const qc = useQueryClient();
  const { data, isLoading } = useJadwal(mode);
  const { data: configData } = useConfig();

  const activeMode = configData?.active_mode ?? "reguler";
  const jadwal = data?.jadwal ?? {};
  const hariList: string[] = data?.hari ?? [];
  const disabledDays: string[] = data?.disabled_days ?? [];
  const toneDir = extractToneDirFromCache(qc);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ModeTabs modes={ALL_MODES} active={mode} activeMode={activeMode} onChange={setMode} />

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {hariList.map((hari) => (
            <HariSection
              key={hari}
              mode={mode}
              hari={hari}
              entries={jadwal[hari] ?? []}
              disabled={disabledDays.includes(hari)}
              toneDir={toneDir}
            />
          ))}
        </div>
      )}
    </div>
  );
}

```
---

## src/components/jadwal/ModeTabs.tsx
```tsx
import React from "react";

const MODE_LABELS: Record<string, string> = {
  reguler: "Reguler",
  ramadhan: "Ramadhan",
  pts: "PTS",
  pas: "PAS",
  pesantren: "Pesantren",
  lainnya: "Lainnya",
};

interface ModeTabsProps {
  modes: string[];
  active: string;
  activeMode: string;
  onChange: (mode: string) => void;
}

export function ModeTabs({ modes, active, activeMode, onChange }: ModeTabsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        paddingBottom: 4,
        scrollbarWidth: "none",
      }}
    >
      {modes.map((m) => {
        const isActive = m === active;
        const isRunning = m === activeMode;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 99,
              border: isActive ? "1px solid var(--accent)" : "1px solid var(--border)",
              background: isActive ? "rgba(9,105,218,0.1)" : "var(--bg-secondary)",
              color: isActive ? "var(--accent)" : "var(--text-muted)",
              fontFamily: "var(--font)",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            {isRunning && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  flexShrink: 0,
                }}
              />
            )}
            {MODE_LABELS[m] ?? m}
          </button>
        );
      })}
    </div>
  );
}

```
---

## src/components/layout/InstallPrompt.tsx
```tsx
import { AnimatePresence, motion } from "framer-motion";
import { Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    "standalone" in window.navigator &&
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [iosShow, setIosShow] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isIos() && !isInStandaloneMode()) {
      const dismissed = localStorage.getItem("ios-install-dismissed");
      if (!dismissed) {
        timer = setTimeout(() => setIosShow(true), 1500);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function dismissIos() {
    localStorage.setItem("ios-install-dismissed", "1");
    setIosShow(false);
  }

  if (show) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          style={{
            position: "fixed",
            bottom: 80,
            left: 16,
            right: 16,
            zIndex: 999,
            background: "var(--card-gloss), var(--card-bg)",
            border: "1px solid var(--card-border)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            borderRadius: "var(--radius-xl)",
            padding: 16,
            boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Install Bel Madrasah</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Akses lebih cepat dari layar utama
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShow(false)}>
            Nanti
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              prompt?.prompt();
              setShow(false);
            }}
          >
            Install
          </Button>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (iosShow) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          style={{
            position: "fixed",
            bottom: 80,
            left: 16,
            right: 16,
            zIndex: 999,
            background: "var(--card-gloss), var(--card-bg)",
            border: "1px solid var(--card-border)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            borderRadius: "var(--radius-xl)",
            padding: 16,
            boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Install Bel Madrasah</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginTop: 6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  Ketuk <Share size={13} style={{ flexShrink: 0 }} /> lalu pilih
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <SquarePlus size={13} style={{ flexShrink: 0 }} /> "Tambah ke Layar Utama"
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={dismissIos}>
              Tutup
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}

```
---

## src/components/layout/Shell.tsx
```tsx
import React, { useEffect, useState } from "react";
import { initTheme } from "../../lib/theme";
import { InstallPrompt } from "./InstallPrompt";
import { BottomNav, Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function Shell({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(() => {
    if (typeof localStorage === "undefined") return true;
    const stored = localStorage.getItem("sidebar-expanded");
    return stored === null ? true : stored === "true";
  });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    initTheme();
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem("sidebar-expanded", String(next));
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {!isMobile && <Sidebar expanded={expanded} onToggle={handleToggle} />}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          marginLeft: isMobile ? 0 : expanded ? 220 : 64,
          transition: "margin-left 0.25s",
        }}
      >
        <TopBar isMobile={isMobile} />
        <main
          style={{
            flex: 1,
            padding: isMobile ? "12px 12px 80px" : "20px 24px",
            overflowY: "auto",
          }}
        >
          {children}
        </main>
      </div>
      {isMobile && <BottomNav />}
      <InstallPrompt />
    </div>
  );
}

```
---

## src/components/layout/Sidebar.tsx
```tsx
import {
  CalendarDays,
  CalendarOff,
  ChevronRight,
  LayoutDashboard,
  Music2,
  ScrollText,
  Settings2,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Jadwal", href: "/jadwal", icon: CalendarDays },
  { label: "Audio", href: "/audio", icon: Music2 },
  { label: "Libur", href: "/libur", icon: CalendarOff },
  { label: "Log", href: "/log", icon: ScrollText },
  { label: "Pengaturan", href: "/settings", icon: Settings2 },
];

function isActive(href: string) {
  if (typeof window === "undefined") return false;
  return href === "/"
    ? window.location.pathname === "/"
    : window.location.pathname.startsWith(href);
}

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

export function Sidebar({ expanded, onToggle }: SidebarProps) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        width: expanded ? 220 : 64,
        background: "var(--card-gloss), var(--card-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.25s",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 10,
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            flexShrink: 0,
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Music2 size={16} color="#fff" />
        </div>
        <span
          style={{
            fontWeight: 700,
            fontSize: 14,
            whiteSpace: "nowrap",
            color: "var(--text)",
            opacity: expanded ? 1 : 0,
            transition: "opacity 0.2s",
          }}
        >
          Bel Madrasah
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px 0", display: "flex", flexDirection: "column", gap: 2 }}>
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <a
              key={href}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 16px",
                margin: "0 6px",
                borderRadius: "var(--radius)",
                color: active ? "var(--accent)" : "var(--text-muted)",
                background: active ? "rgba(9,105,218,0.08)" : "transparent",
                textDecoration: "none",
                fontWeight: active ? 600 : 400,
                fontSize: 13,
                transition: "background 0.15s, color 0.15s",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              <span
                style={{
                  opacity: expanded ? 1 : 0,
                  transition: "opacity 0.2s",
                }}
              >
                {label}
              </span>
            </a>
          );
        })}
      </nav>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: expanded ? "flex-end" : "center",
          padding: "12px 16px",
          background: "none",
          border: "none",
          borderTop: "1px solid var(--border)",
          cursor: "pointer",
          color: "var(--text-muted)",
          transition: "justify-content 0.25s",
        }}
      >
        <ChevronRight
          size={16}
          style={{
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.25s",
          }}
        />
      </button>
    </div>
  );
}

export function BottomNav() {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "var(--card-gloss), var(--card-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        borderTop: "1px solid var(--border)",
        display: "flex",
      }}
    >
      {navItems.map(({ label, href, icon: Icon }) => {
        const active = isActive(href);
        return (
          <a
            key={href}
            href={href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "8px 0",
              gap: 3,
              textDecoration: "none",
              color: active ? "var(--accent)" : "var(--text-muted)",
              fontSize: 10,
              fontWeight: active ? 600 : 400,
            }}
          >
            <Icon size={20} />
            {label}
          </a>
        );
      })}
    </div>
  );
}

```
---

## src/components/layout/TopBar.tsx
```tsx
import { Moon, Music2, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { getTheme, toggleTheme } from "../../lib/theme";

interface TopBarProps {
  isMobile: boolean;
}

export function TopBar({ isMobile }: TopBarProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [title, setTitle] = useState("Dashboard");

  useEffect(() => {
    setTheme(getTheme());
    const path = window.location.pathname;
    const map: Record<string, string> = {
      "/": "Dashboard",
      "/jadwal": "Jadwal",
      "/audio": "Audio",
      "/libur": "Hari Libur",
      "/log": "Log Aktivitas",
      "/settings": "Pengaturan",
    };
    setTitle(map[path] ?? "Bel Madrasah");
  }, []);

  function handleToggle() {
    toggleTheme();
    setTheme(getTheme());
  }

  return (
    <div
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--card-gloss), var(--card-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {isMobile && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Music2 size={16} color="#fff" />
          </div>
        )}
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
      </div>

      <button
        onClick={handleToggle}
        style={{
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          cursor: "pointer",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          padding: "6px 8px",
        }}
      >
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}

```
---

## src/components/libur/LiburList.tsx
```tsx
import React, { useState } from "react";
import { Plus, Trash2, CalendarOff } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { LiburModal } from "./LiburModal";
import { SkeletonCard } from "../ui/Skeleton";
import { useLibur, useMutateLibur } from "../../hooks/useLibur";
import toast from "react-hot-toast";

interface LiburDate {
  date: string;
  keterangan: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function isUpcoming(dateStr: string) {
  return new Date(dateStr + "T00:00:00") >= new Date(new Date().toDateString());
}

export function LiburList() {
  const { data, isLoading } = useLibur();
  const mutate = useMutateLibur();
  const [modalOpen, setModalOpen] = useState(false);

  const libur: LiburDate[] = data?.libur ?? [];

  async function handleSave(date: string, keterangan: string) {
    try {
      await mutate.mutateAsync({ action: "add", date, keterangan });
      toast.success("Hari libur ditambahkan");
      setModalOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDelete(date: string) {
    if (!confirm(`Hapus libur ${formatDate(date)}?`)) return;
    try {
      await mutate.mutateAsync({ action: "delete", date, keterangan: "" });
      toast.success("Hari libur dihapus");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) return <SkeletonCard />;

  return (
    <>
      <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Libur Lokal
            </span>
            <Badge variant="default">{libur.length}</Badge>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={13} />}
            onClick={() => setModalOpen(true)}
          >
            Tambah
          </Button>
        </div>

        {libur.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              padding: "24px 0",
              color: "var(--text-muted)",
            }}
          >
            <CalendarOff size={28} />
            <span style={{ fontSize: 13, fontStyle: "italic" }}>Belum ada hari libur</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {libur.map((item) => {
              const upcoming = isUpcoming(item.date);
              return (
                <div
                  key={item.date}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatDate(item.date)}
                      </span>
                      {upcoming && <Badge variant="warning">Mendatang</Badge>}
                    </div>
                    {item.keterangan && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {item.keterangan}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={13} />}
                    onClick={() => handleDelete(item.date)}
                    loading={mutate.isPending}
                    style={{ color: "var(--danger)", flexShrink: 0 }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <LiburModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        loading={mutate.isPending}
      />
    </>
  );
}

```
---

## src/components/libur/LiburModal.tsx
```tsx
import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

interface LiburModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (date: string, keterangan: string) => void;
  loading?: boolean;
}

export function LiburModal({ open, onClose, onSave, loading }: LiburModalProps) {
  const [date, setDate] = useState("");
  const [keterangan, setKeterangan] = useState("");

  useEffect(() => {
    if (open) {
      setDate("");
      setKeterangan("");
    }
  }, [open]);

  function handleSave() {
    if (!date) return;
    onSave(date, keterangan);
  }

  return (
    <Modal open={open} onClose={onClose} title="Tambah Hari Libur" width={400}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Tanggal
          </label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Keterangan
          </label>
          <input
            type="text"
            placeholder="contoh: HUT RI, Libur Semester..."
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" loading={loading} disabled={!date} onClick={handleSave}>
            Simpan
          </Button>
        </div>
      </div>
    </Modal>
  );
}

```
---

## src/components/libur/LiburPage.tsx
```tsx
import { ExternalLink, Plus } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useLiburNasional, useMutateLibur } from "../../hooks/useLibur";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { LiburList } from "./LiburList";

interface NasionalItem {
  date: string;
  name: string;
  is_national_holiday: boolean;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long" });
}

function LiburNasionalPanel() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data, isLoading } = useLiburNasional(year);
  const mutate = useMutateLibur();

  const items: NasionalItem[] = Array.isArray(data) ? data : [];
  const nationals = items.filter((i) => i.is_national_holiday);

  async function handleImport(item: NasionalItem) {
    try {
      await mutate.mutateAsync({
        action: "add",
        date: item.date,
        keterangan: item.name,
      });
      toast.success(`${item.name} ditambahkan`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Libur Nasional
        </span>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 36,
                borderRadius: "var(--radius)",
                background: "var(--bg-tertiary)",
                animation: "shimmer 1.5s infinite",
                backgroundSize: "200% 100%",
              }}
            />
          ))}
        </div>
      ) : nationals.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-muted)",
            fontStyle: "italic",
            textAlign: "center",
            padding: "16px 0",
          }}
        >
          Tidak ada data
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            maxHeight: 420,
            overflowY: "auto",
          }}
        >
          {nationals.map((item) => (
            <div
              key={item.date}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {formatDate(item.date)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus size={12} />}
                onClick={() => handleImport(item)}
                loading={mutate.isPending}
                style={{ flexShrink: 0 }}
              >
                Import
              </Button>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <ExternalLink size={10} />
        Sumber: libur.deno.dev
      </div>
    </Card>
  );
}

export function LiburPage() {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 md:col-span-7">
        <LiburList />
      </div>
      <div className="col-span-12 md:col-span-5">
        <LiburNasionalPanel />
      </div>
    </div>
  );
}

```
---

## src/components/log/LogPage.tsx
```tsx
import React, { useState } from "react";
import { RotateCcw, Clock } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { SkeletonCard } from "../ui/Skeleton";
import { useLog, useResetLog } from "../../hooks/useLog";
import toast from "react-hot-toast";

interface LogEntry {
  time: string;
  mode: string;
  hari: string;
  waktu: string;
  audio: string;
}

const MODE_VARIANT: Record<string, "accent" | "success" | "warning" | "danger" | "default"> = {
  reguler: "accent",
  ramadhan: "success",
  pts: "warning",
  pas: "warning",
  pesantren: "default",
  lainnya: "default",
};

const MODE_LABELS: Record<string, string> = {
  reguler: "Reguler",
  ramadhan: "Ramadhan",
  pts: "PTS",
  pas: "PAS",
  pesantren: "Pesantren",
  lainnya: "Lainnya",
};

export function LogPage() {
  const { data, isLoading } = useLog();
  const reset = useResetLog();
  const [confirmReset, setConfirmReset] = useState(false);

  const logs: LogEntry[] = data?.logs ?? [];

  async function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    try {
      await reset.mutateAsync();
      toast.success("Log berhasil direset");
      setConfirmReset(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (isLoading) return <SkeletonCard />;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Log Aktivitas
          </span>
          <Badge variant="default">{logs.length}</Badge>
        </div>
        <Button
          variant={confirmReset ? "danger" : "ghost"}
          size="sm"
          icon={<RotateCcw size={13} />}
          loading={reset.isPending}
          onClick={handleReset}
        >
          {confirmReset ? "Konfirmasi Reset" : "Reset Log"}
        </Button>
      </div>

      {logs.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            padding: "32px 0",
            color: "var(--text-muted)",
          }}
        >
          <Clock size={28} />
          <span style={{ fontSize: 13, fontStyle: "italic" }}>Belum ada aktivitas</span>
        </div>
      ) : (
        <>
          <div
            style={{
              overflowX: "auto",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
                minWidth: 520,
              }}
            >
              <thead>
                <tr style={{ background: "var(--bg-secondary)" }}>
                  {["Waktu", "Mode", "Hari", "Jam", "Audio"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        fontWeight: 600,
                        color: "var(--text-muted)",
                        borderBottom: "1px solid var(--border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: i < logs.length - 1 ? "1px solid var(--border)" : "none",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        "var(--bg-secondary)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                    }}
                  >
                    <td
                      style={{
                        padding: "8px 12px",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {log.time}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <Badge variant={MODE_VARIANT[log.mode] ?? "default"}>
                        {MODE_LABELS[log.mode] ?? log.mode}
                      </Badge>
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--text)" }}>{log.hari}</td>
                    <td
                      style={{
                        padding: "8px 12px",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 500,
                        color: "var(--text)",
                      }}
                    >
                      {log.waktu}
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        color: "var(--text-muted)",
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {log.audio}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
            Menampilkan {logs.length} entri terbaru
          </div>
        </>
      )}
    </Card>
  );
}

```
---

## src/components/pengaturan/PengaturanPage.tsx
```tsx
import { Activity, Download, RefreshCw, Shield, Upload } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useServiceStatus, useUpdateVolume, useVolume } from "../../hooks/useConfig";
import { api } from "../../lib/api";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Slider } from "../ui/Slider";

function SectionHeader({ title }: { title: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {title}
    </span>
  );
}

function VolumeSection() {
  const { data } = useVolume();
  const update = useUpdateVolume();
  const [local, setLocal] = useState<number>(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data?.volume != null) setLocal(data.volume);
  }, [data?.volume]);

  function handleChange(val: number) {
    setLocal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await update.mutateAsync(val);
        toast.success("Volume disimpan");
      } catch (e: any) {
        toast.error(e.message);
      }
    }, 300);
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHeader title="Volume Output" />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Level volume</span>
        <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {Math.round(local * 100)}%
        </span>
      </div>
      <Slider
        value={local}
        min={0}
        max={2}
        step={0.01}
        onChange={handleChange}
        disabled={update.isPending}
        formatLabel={(v) => `${Math.round(v * 100)}%`}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        <span>0%</span>
        <span style={{ color: local > 1 ? "var(--warning)" : "var(--text-muted)" }}>
          {local > 1 ? "Amplifikasi aktif — bisa distorsi" : "100% = volume normal"}
        </span>
        <span>200%</span>
      </div>
    </Card>
  );
}

function PasswordSection() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password baru minimal 8 karakter");
      return;
    }
    if (newPassword !== confirm) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      toast.success("Password berhasil diubah");
      setOldPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Shield size={14} color="var(--text-muted)" />
        <SectionHeader title="Ganti Password" />
      </div>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Password Lama
          </label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Password Baru
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Minimal 8 karakter</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Konfirmasi Password Baru
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
          {confirm && newPassword !== confirm && (
            <span style={{ fontSize: 11, color: "var(--danger)" }}>Password tidak cocok</span>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="primary" loading={loading}>
            Simpan Password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function BackupSection() {
  const restoreRef = useRef<HTMLInputElement>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  function handleBackup() {
    window.location.href = "/api/backup";
  }

  async function handleRestore(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.name.endsWith(".json")) {
      toast.error("File harus berformat JSON");
      return;
    }
    if (!confirm(`Restore jadwal dari ${file.name}? Data jadwal saat ini akan ditimpa.`)) return;

    setRestoreLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      await api.upload("/api/restore", form);
      toast.success("Jadwal berhasil direstore");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRestoreLoading(false);
      if (restoreRef.current) restoreRef.current.value = "";
    }
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionHeader title="Backup & Restore" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            borderRadius: "var(--radius)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Download Backup</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Ekspor semua jadwal ke file JSON
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={13} />}
            onClick={handleBackup}
          >
            Download
          </Button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 14px",
            borderRadius: "var(--radius)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Restore Backup</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Import jadwal dari file JSON backup
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload size={13} />}
            loading={restoreLoading}
            onClick={() => restoreRef.current?.click()}
          >
            Restore
          </Button>
        </div>
        <input
          ref={restoreRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={(e) => handleRestore(e.target.files)}
        />
      </div>
    </Card>
  );
}

function InfoSection() {
  const { data, isLoading, refetch } = useServiceStatus();
  const [healthStatus, setHealthStatus] = useState<"ok" | "error" | "checking" | null>(null);

  async function checkHealth() {
    setHealthStatus("checking");
    try {
      const res = await fetch("/healthz", { credentials: "include" });
      setHealthStatus(res.ok ? "ok" : "error");
    } catch {
      setHealthStatus("error");
    }
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Activity size={14} color="var(--text-muted)" />
        <SectionHeader title="Info & Status" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          {
            label: "Scheduler",
            value: isLoading ? "-" : data?.running ? "Berjalan" : "Dihentikan",
            variant: data?.running ? "success" : "danger",
          },
          {
            label: "Mode Aktif",
            value: data?.active_mode ?? "-",
            variant: "accent",
          },
          {
            label: "Status Hari",
            value: data?.is_libur ? "Libur" : "Aktif",
            variant: data?.is_libur ? "warning" : "default",
          },
        ].map(({ label, value, variant }) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--text-muted)" }}>{label}</span>
            <Badge variant={variant as any}>{value}</Badge>
          </div>
        ))}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>Health Check</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {healthStatus && (
              <Badge
                variant={
                  healthStatus === "ok"
                    ? "success"
                    : healthStatus === "error"
                      ? "danger"
                      : "default"
                }
                dot
              >
                {healthStatus === "ok" ? "OK" : healthStatus === "error" ? "Error" : "Checking..."}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={12} />}
              onClick={checkHealth}
              loading={healthStatus === "checking"}
            >
              Cek
            </Button>
          </div>
        </div>
      </div>

      <div
        style={{
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-muted)",
        }}
      >
        <span>Bel Madrasah</span>
        <span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--text-muted)" }}
          >
            GitHub
          </a>
        </span>
      </div>
    </Card>
  );
}

export function PengaturanPage() {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div
        className="col-span-12 md:col-span-6"
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <VolumeSection />
        <PasswordSection />
      </div>
      <div
        className="col-span-12 md:col-span-6"
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <BackupSection />
        <InfoSection />
      </div>
    </div>
  );
}

```
---

## src/components/ui/Badge.tsx
```tsx
import React from "react";

type BadgeVariant = "default" | "success" | "danger" | "warning" | "accent";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantStyle: Record<BadgeVariant, React.CSSProperties> = {
  default: { background: "var(--bg-tertiary)", color: "var(--text-muted)" },
  success: { background: "rgba(26,127,55,0.12)", color: "var(--success)" },
  danger: { background: "rgba(207,34,46,0.12)", color: "var(--danger)" },
  warning: { background: "rgba(154,103,0,0.12)", color: "var(--warning)" },
  accent: { background: "rgba(9,105,218,0.12)", color: "var(--accent)" },
};

export function Badge({ children, variant = "default", dot }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 500,
        ...variantStyle[variant],
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "currentColor",
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

```
---

## src/components/ui/Button.tsx
```tsx
import React from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyle: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--accent)", color: "#fff", border: "1px solid transparent" },
  secondary: {
    background: "var(--bg-tertiary)",
    color: "var(--text)",
    border: "1px solid var(--border)",
  },
  danger: { background: "var(--danger)", color: "#fff", border: "1px solid transparent" },
  ghost: { background: "transparent", color: "var(--text-muted)", border: "1px solid transparent" },
};

const sizeStyle: Record<Size, React.CSSProperties> = {
  sm: { padding: "4px 10px", fontSize: "12px", height: "28px" },
  md: { padding: "6px 14px", fontSize: "13px", height: "34px" },
  lg: { padding: "10px 20px", fontSize: "14px", height: "42px" },
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  children,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        borderRadius: "var(--radius)",
        fontFamily: "var(--font)",
        fontWeight: 500,
        cursor: loading || props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.5 : 1,
        transition: "opacity 0.15s, transform 0.1s, box-shadow 0.15s",
        whiteSpace: "nowrap",
        ...variantStyle[variant],
        ...sizeStyle[size],
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!props.disabled && !loading) {
          (e.currentTarget as HTMLButtonElement).style.opacity = "0.85";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = props.disabled ? "0.5" : "1";
      }}
      onMouseDown={(e) => {
        if (!props.disabled && !loading) {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)";
        }
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
    >
      {loading ? (
        <span
          style={{
            width: 14,
            height: 14,
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.6s linear infinite",
            flexShrink: 0,
          }}
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

```
---

## src/components/ui/Card.tsx
```tsx
import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glossy?: boolean;
  hover?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function Card({
  children,
  className = "",
  glossy = true,
  hover = false,
  onClick,
  style,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: glossy ? "var(--card-gloss), var(--card-bg)" : "var(--bg-secondary)",
        border: "1px solid var(--card-border)",
        boxShadow: "var(--card-shadow)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        borderRadius: "var(--radius-lg)",
        padding: "16px",
        transition: "transform 0.2s, box-shadow 0.2s",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
      onMouseEnter={
        hover
          ? (e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = "translateY(-2px)";
              el.style.boxShadow = "0 8px 32px rgba(0,0,0,0.12)";
            }
          : undefined
      }
      onMouseLeave={
        hover
          ? (e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = "translateY(0)";
              el.style.boxShadow = "var(--card-shadow)";
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

```
---

## src/components/ui/Modal.tsx
```tsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, children, width = 480 }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              width: "100%",
              maxWidth: width,
              background: "var(--card-gloss), var(--card-bg)",
              border: "1px solid var(--card-border)",
              backdropFilter: "var(--glass-blur)",
              WebkitBackdropFilter: "var(--glass-blur)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  padding: 4,
                  borderRadius: 6,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 20 }}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

```
---

## src/components/ui/Skeleton.tsx
```tsx
import React from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  style?: React.CSSProperties;
}

export function Skeleton({
  width = "100%",
  height = 16,
  radius = "var(--radius)",
  style,
}: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background:
          "linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        ...style,
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div
      style={{
        background: "var(--card-gloss), var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Skeleton height={14} width="40%" />
      <Skeleton height={28} width="60%" />
      <Skeleton height={12} width="80%" />
    </div>
  );
}

```
---

## src/components/ui/Slider.tsx
```tsx
import React from "react";

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  formatLabel?: (val: number) => string;
}

export function Slider({
  value,
  min = 0,
  max = 2,
  step = 0.01,
  onChange,
  disabled,
  formatLabel,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {formatLabel && (
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
          {formatLabel(value)}
        </span>
      )}
      <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 4,
            borderRadius: 99,
            background: "var(--bg-tertiary)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "var(--accent)",
              borderRadius: 99,
              transition: "width 0.1s",
            }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            width: "100%",
            opacity: 0,
            height: 20,
            cursor: disabled ? "not-allowed" : "pointer",
            margin: 0,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `calc(${pct}% - 8px)`,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "var(--accent)",
            border: "2px solid var(--bg)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            transition: "left 0.1s",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

```
---

## src/components/ui/Toggle.tsx
```tsx
import React from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 99,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "var(--accent)" : "var(--bg-tertiary)",
        position: "relative",
        transition: "background 0.2s",
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        }}
      />
    </button>
  );
}

```
---

## src/hooks/useAudio.ts
```ts
import { useRef, useState } from "react";
import { api } from "../lib/api";

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  async function preview(filename: string, endpoint: string, body: object) {
    try {
      const res: any = await api.post(endpoint, body);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const a = new Audio(res.url);
      audioRef.current = a;
      setPlaying(filename);
      a.onended = () => setPlaying(null);
      a.onerror = () => setPlaying(null);
      await a.play();
    } catch {
      setPlaying(null);
    }
  }

  async function stop(endpoint = "/api/tones/stop") {
    try {
      await api.post(endpoint, {});
    } finally {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlaying(null);
    }
  }

  function isPlaying(filename: string) {
    return playing === filename;
  }

  return { playing, preview, stop, isPlaying };
}

```
---

## src/hooks/useConfig.ts
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: () => api.get("/api/config"),
    staleTime: 30_000,
    refetchInterval: 15_000,
  });
}

export function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/api/config", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["config"] }),
  });
}

export function useServiceStatus() {
  return useQuery({
    queryKey: ["service-status"],
    queryFn: () => api.get("/api/service/status"),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

export function useServiceToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/service/toggle", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-status"] });
      qc.invalidateQueries({ queryKey: ["config"] });
    },
  });
}

export function useVolume() {
  return useQuery({
    queryKey: ["volume"],
    queryFn: () => api.get("/api/volume"),
    staleTime: 60_000,
  });
}

export function useUpdateVolume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (volume: number) => api.post("/api/volume", { volume }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["volume"] });
      qc.invalidateQueries({ queryKey: ["config"] });
      qc.invalidateQueries({ queryKey: ["service-status"] });
    },
  });
}

```
---

## src/hooks/useJadwal.ts
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useJadwal(mode: string) {
  return useQuery({
    queryKey: ["jadwal", mode],
    queryFn: () => api.get(`/api/jadwal?mode=${mode}`),
    staleTime: 60_000,
  });
}

export function useJadwalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post("/api/jadwal/entry", body),
    onSuccess: (_data, variables: any) => {
      qc.invalidateQueries({ queryKey: ["jadwal", variables.mode] });
    },
  });
}

export function useDayToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { mode: string; hari: string; disable: boolean }) =>
      api.post("/api/jadwal/day-toggle", body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["jadwal", variables.mode] });
    },
  });
}

```
---

## src/hooks/useLibur.ts
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useLibur() {
  return useQuery({
    queryKey: ["libur"],
    queryFn: () => api.get("/api/libur"),
    staleTime: 60_000,
  });
}

export function useLiburNasional(year: number) {
  return useQuery({
    queryKey: ["libur-nasional", year],
    queryFn: () => api.get(`/api/libur/nasional?year=${year}`),
    staleTime: 24 * 60 * 60_000,
  });
}

export function useMutateLibur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { action: "add" | "delete"; date: string; keterangan: string }) =>
      api.post("/api/libur", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["libur"] }),
  });
}

```
---

## src/hooks/useLog.ts
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useLog() {
  return useQuery({
    queryKey: ["log"],
    queryFn: () => api.get("/api/log"),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useResetLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/log/reset", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["log"] }),
  });
}

```
---

## src/hooks/useMediaQuery.ts
```ts
import { useState, useEffect } from "react";

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [breakpoint]);

  return isMobile;
}

```
---

## src/hooks/useTones.ts
```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useTones(page: number, perPage = 20) {
  return useQuery({
    queryKey: ["tones", page, perPage],
    queryFn: () => api.get(`/api/tones?page=${page}&per_page=${perPage}`),
    staleTime: 60_000,
    placeholderData: (prev: any) => prev,
  });
}

export function useUploadTone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.upload("/api/tones/upload", form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tones"] }),
  });
}

export function useDeleteTone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) => api.post("/api/tones/delete", { filename }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tones"] }),
  });
}

export function usePreviewTone() {
  return useMutation({
    mutationFn: (filename: string) => api.post("/api/tones/preview", { filename }),
  });
}

export function useStopTone() {
  return useMutation({
    mutationFn: () => api.post("/api/tones/stop", {}),
  });
}

```
---

## src/lib/api.ts
```ts
const BASE = import.meta.env.PUBLIC_API_URL ?? "";

let redirectingToLogin = false;

async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const isFormData = body instanceof FormData;
  const res = await fetch(BASE + path, {
    method,
    credentials: "include",
    headers: isFormData ? undefined : body ? { "Content-Type": "application/json" } : undefined,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    if (!redirectingToLogin && window.location.pathname !== "/login") {
      redirectingToLogin = true;
      window.location.href = "/login";
    }
    return new Promise<T>(() => {});
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Terjadi kesalahan" }));
    throw new Error(err.error ?? "Terjadi kesalahan");
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return res.json();
  return res as unknown as T;
}

export const api = {
  get: <T = unknown>(path: string) => request<T>("GET", path),
  post: <T = unknown>(path: string, body: unknown) => request<T>("POST", path, body),
  upload: <T = unknown>(path: string, form: FormData) => request<T>("POST", path, form),
};

```
---

## src/lib/queryClient.ts
```ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

```
---

## src/lib/router.ts
```ts
const pageCache = new Map<string, string>(); // in-memory cache

const PAGE_MAP: Record<string, string> = {
  "/": "dashboard",
  "/jadwal": "jadwal",
  "/audio": "audio",
  "/libur": "libur",
  "/log": "log",
  "/settings": "settings",
};

async function fetchPage(url: string): Promise<string | null> {
  if (pageCache.has(url)) return pageCache.get(url)!;
  try {
    const res = await fetch(url, { credentials: "include" });
    if (res.status === 401) {
      window.location.href = "/login";
      return null;
    }
    if (!res.ok) return null;
    const html = await res.text();
    pageCache.set(url, html);
    return html;
  } catch {
    return null;
  }
}

function extractTitle(html: string): string {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? match[1] : "Bel Madrasah";
}

let isNavigating = false;

async function navigate(path: string, pushState = true) {
  if (isNavigating || window.location.pathname === path) return;
  isNavigating = true;

  try {
    const html = await fetchPage(path);
    if (!html) {
      window.location.href = path;
      return;
    }

    if (pushState) {
      window.history.pushState({}, "", path);
    }

    document.title = extractTitle(html);

    // Dispatch custom event — App.tsx listen dan ganti page prop
    window.dispatchEvent(new CustomEvent("spa-navigate", { detail: { path } }));

    // Re-attach SPA listeners setelah React re-render
    setTimeout(attachListeners, 50);
  } finally {
    isNavigating = false;
  }
}

function prefetch(path: string) {
  if (!pageCache.has(path) && PAGE_MAP[path]) {
    fetchPage(path);
  }
}

export function attachListeners() {
  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (!PAGE_MAP[href]) return;
    if (a.dataset.spa === "1") return;
    a.dataset.spa = "1";

    // Prefetch on hover
    a.addEventListener("mouseenter", () => prefetch(href), { once: true });

    // Navigate on click
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(href);
    });
  });
}

export function initRouter() {
  // Handle browser back/forward
  window.addEventListener("popstate", () => {
    navigate(window.location.pathname, false);
  });

  // Prefetch all known pages on idle
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => {
      Object.keys(PAGE_MAP).forEach(prefetch);
    });
  }

  attachListeners();
}

```
---

## src/lib/theme.ts
```ts
export function getTheme(): "light" | "dark" {
  if (typeof localStorage === "undefined") return "light";
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function setTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

export function toggleTheme() {
  const current = getTheme();
  setTheme(current === "dark" ? "light" : "dark");
}

export function initTheme() {
  setTheme(getTheme());
}

```
---

## src/pages/404.astro
```astro
---
import "../styles/global.css";
---

<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>404 — Bel Madrasah</title>
  </head>
  <body
    style="margin:0;font-family:'Lexend',sans-serif;background:var(--bg);color:var(--text);display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px;"
  >
    <div style="font-size:64px;font-weight:700;color:var(--text-muted)">404</div>
    <div style="font-size:16px;color:var(--text-muted)">Halaman tidak ditemukan</div>
    <a
      href="/"
      style="margin-top:8px;padding:8px 20px;background:var(--accent);color:#fff;border-radius:12px;text-decoration:none;font-size:13px;font-weight:500;"
      >Kembali ke Dashboard</a
    >
  </body>
</html>

```
---

## src/pages/audio.astro
```astro
---
import "../styles/global.css";
import App from "../components/App";
---

<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0969da" />
    <link rel="manifest" href="/manifest.json" />
    <title>Audio — Bel Madrasah</title>
  </head>
  <body>
    <App page="audio" client:only="react" />
  </body>
</html>

```
---

## src/pages/index.astro
```astro
---
import App from "../components/App";
import "../styles/global.css";
---

<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0969da" />
    <link rel="manifest" href="/manifest.json" />
    <title>Dashboard — Bel Madrasah</title>
  </head>
  <body>
    <App page="dashboard" client:only="react" />
  </body>
</html>

```
---

## src/pages/jadwal.astro
```astro
---
import "../styles/global.css";
import App from "../components/App";
---

<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0969da" />
    <link rel="manifest" href="/manifest.json" />
    <title>Jadwal — Bel Madrasah</title>
  </head>
  <body>
    <App page="jadwal" client:only="react" />
  </body>
</html>

```
---

## src/pages/libur.astro
```astro
---
import "../styles/global.css";
import App from "../components/App";
---

<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0969da" />
    <link rel="manifest" href="/manifest.json" />
    <title>Hari Libur — Bel Madrasah</title>
  </head>
  <body>
    <App page="libur" client:only="react" />
  </body>
</html>

```
---

## src/pages/log.astro
```astro
---
import "../styles/global.css";
import App from "../components/App";
---

<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0969da" />
    <link rel="manifest" href="/manifest.json" />
    <title>Log Aktivitas — Bel Madrasah</title>
  </head>
  <body>
    <App page="log" client:only="react" />
  </body>
</html>

```
---

## src/pages/login.astro
```astro
---
import "../styles/global.css";
import { LoginPage } from "../components/auth/LoginPage";
---

<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0969da" />
    <link rel="manifest" href="/manifest.json" />
    <title>Login — Bel Madrasah</title>
  </head>
  <body>
    <LoginPage client:only="react" />
  </body>
</html>

```
---

## src/pages/settings.astro
```astro
---
import "../styles/global.css";
import App from "../components/App";
---

<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0969da" />
    <link rel="manifest" href="/manifest.json" />
    <title>Pengaturan — Bel Madrasah</title>
  </head>
  <body>
    <App page="settings" client:only="react" />
  </body>
</html>

```
---

## src/styles/global.css
```css
@import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap');

@import "tailwindcss";

@theme {
  --font-family-sans: 'Lexend', sans-serif;
}

:root {
  --font: 'Lexend', sans-serif;
  --bg: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-tertiary: #eaeef2;
  --border: #d0d7de;
  --text: #1f2328;
  --text-muted: #656d76;
  --accent: #0969da;
  --accent-hover: #0860ca;
  --success: #1a7f37;
  --danger: #cf222e;
  --warning: #9a6700;
  --glass-bg: rgba(255, 255, 255, 0.6);
  --glass-border: rgba(255, 255, 255, 0.8);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  --glass-blur: blur(20px);
  --card-bg: rgba(255, 255, 255, 0.72);
  --card-border: rgba(255, 255, 255, 0.9);
  --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --card-gloss: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.3) 100%);
  --radius: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
}

[data-theme="dark"] {
  --bg: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --border: #30363d;
  --text: #e6edf3;
  --text-muted: #7d8590;
  --accent: #58a6ff;
  --accent-hover: #79b8ff;
  --success: #3fb950;
  --danger: #f85149;
  --warning: #d29922;
  --glass-bg: rgba(22, 27, 34, 0.72);
  --glass-border: rgba(48, 54, 61, 0.8);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  --card-bg: rgba(22, 27, 34, 0.8);
  --card-border: rgba(48, 54, 61, 0.6);
  --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
  --card-gloss: linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.01) 100%);
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

::selection {
  background: var(--accent);
  color: #fff;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 99px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

input,
select,
textarea {
  font-family: var(--font);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  width: 100%;
  padding: 8px 12px;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.12);
}

[data-theme="dark"] input:focus,
[data-theme="dark"] select:focus,
[data-theme="dark"] textarea:focus {
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
}

input[type="time"]::-webkit-calendar-picker-indicator {
  filter: invert(0.5);
  cursor: pointer;
}

a {
  color: var(--accent);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

button {
  font-family: var(--font);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.8);
    opacity: 1;
  }

  100% {
    transform: scale(2);
    opacity: 0;
  }
}

@keyframes wave {

  0%,
  100% {
    transform: scaleY(0.4);
  }

  50% {
    transform: scaleY(1);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }

  100% {
    background-position: 200% 0;
  }
}

.wave-bar {
  width: 3px;
  border-radius: 99px;
  background: var(--accent);
  animation: wave 1s ease-in-out infinite;
}

.wave-bar:nth-child(2) {
  animation-delay: 0.1s;
}

.wave-bar:nth-child(3) {
  animation-delay: 0.2s;
}

.wave-bar:nth-child(4) {
  animation-delay: 0.3s;
}

.wave-bar:nth-child(5) {
  animation-delay: 0.15s;
}

.animate-fade-in {
  animation: fade-in 0.3s ease forwards;
}

.glass {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--glass-shadow);
}

.card-glossy {
  background: var(--card-gloss), var(--card-bg);
  border: 1px solid var(--card-border);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--card-shadow);
  border-radius: var(--radius-lg);
}

```
---

## storage.go
```go
package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

const (
	jadwalFile  = dataDir + "/jadwal.json"
	logFile     = dataDir + "/activity.log"
	configFile  = dataDir + "/config.json"
	maxLogLines = 500
	logRotateAt = maxLogLines * 2
)

type Entry struct {
	Waktu string `json:"waktu"`
	Audio string `json:"audio"`
}

type ModeJadwal map[string]map[string][]Entry

type Config struct {
	Mode           string              `json:"mode"`
	ManualOverride bool                `json:"manual_override"`
	RamadhanStart  string              `json:"ramadhan_start"`
	RamadhanEnd    string              `json:"ramadhan_end"`
	PTSStart       string              `json:"pts_start"`
	PTSEnd         string              `json:"pts_end"`
	PASStart       string              `json:"pas_start"`
	PASEnd         string              `json:"pas_end"`
	PesantrenStart string              `json:"pesantren_start"`
	PesantrenEnd   string              `json:"pesantren_end"`
	LiburDates     []LiburDate         `json:"libur_dates"`
	Volume         float64             `json:"volume"`
	DisabledDays   map[string][]string `json:"disabled_days"`
}

type LiburDate struct {
	Date       string `json:"date"`
	Keterangan string `json:"keterangan"`
}

type ActivityLog struct {
	Time  string `json:"time"`
	Mode  string `json:"mode"`
	Hari  string `json:"hari"`
	Waktu string `json:"waktu"`
	Audio string `json:"audio"`
}

var (
	jadwalMu sync.RWMutex
	configMu sync.RWMutex
	logMu    sync.Mutex
	logCount int
)

var AllHari = []string{"Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"}
var AllModes = []string{"reguler", "ramadhan", "pts", "pas", "pesantren", "lainnya"}

func defaultConfig() Config {
	return Config{
		Mode:         "reguler",
		Volume:       0.85,
		LiburDates:   []LiburDate{},
		DisabledDays: map[string][]string{},
	}
}

func loadConfig() (Config, error) {
	configMu.RLock()
	defer configMu.RUnlock()

	data, err := os.ReadFile(configFile)
	if err != nil {
		return defaultConfig(), nil
	}
	var c Config
	if err := json.Unmarshal(data, &c); err != nil {
		return defaultConfig(), nil
	}
	if c.LiburDates == nil {
		c.LiburDates = []LiburDate{}
	}
	if c.DisabledDays == nil {
		c.DisabledDays = map[string][]string{}
	}
	if c.Volume == 0 {
		c.Volume = 0.85
	}
	return c, nil
}

func saveConfig(c Config) error {
	configMu.Lock()
	defer configMu.Unlock()
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return atomicWrite(configFile, data, 0644)
}

func resolveMode(c Config) string {
	if c.ManualOverride {
		return c.Mode
	}
	today := time.Now().Format("2006-01-02")
	if c.PTSStart != "" && c.PTSEnd != "" && today >= c.PTSStart && today <= c.PTSEnd {
		return "pts"
	}
	if c.PASStart != "" && c.PASEnd != "" && today >= c.PASStart && today <= c.PASEnd {
		return "pas"
	}
	if c.PesantrenStart != "" && c.PesantrenEnd != "" && today >= c.PesantrenStart && today <= c.PesantrenEnd {
		return "pesantren"
	}
	if c.RamadhanStart != "" && c.RamadhanEnd != "" && today >= c.RamadhanStart && today <= c.RamadhanEnd {
		return "ramadhan"
	}
	return "reguler"
}

func isLibur(c Config) bool {
	today := time.Now().Format("2006-01-02")
	for _, d := range c.LiburDates {
		if d.Date == today {
			return true
		}
	}
	return false
}

func isDayDisabled(c Config, mode, hari string) bool {
	days, ok := c.DisabledDays[mode]
	if !ok {
		return false
	}
	for _, d := range days {
		if d == hari {
			return true
		}
	}
	return false
}

func loadJadwal() (ModeJadwal, error) {
	jadwalMu.RLock()
	defer jadwalMu.RUnlock()

	data, err := os.ReadFile(jadwalFile)
	if err != nil {
		return nil, err
	}
	var j ModeJadwal
	if err := json.Unmarshal(data, &j); err != nil {
		return nil, err
	}
	if j == nil {
		j = make(ModeJadwal)
	}
	for _, m := range AllModes {
		if j[m] == nil {
			j[m] = map[string][]Entry{}
		}
		for _, h := range AllHari {
			if j[m][h] == nil {
				j[m][h] = []Entry{}
			}
		}
	}
	return j, nil
}

func saveJadwal(j ModeJadwal) error {
	jadwalMu.Lock()
	defer jadwalMu.Unlock()
	data, err := json.MarshalIndent(j, "", "  ")
	if err != nil {
		return err
	}
	return atomicWrite(jadwalFile, data, 0644)
}

func atomicWrite(path string, data []byte, perm os.FileMode) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, perm); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func copyEntries(src []Entry) []Entry {
	dst := make([]Entry, len(src))
	copy(dst, src)
	return dst
}

func initStorage() error {
	if _, err := os.Stat(configFile); os.IsNotExist(err) {
		if err := saveConfig(defaultConfig()); err != nil {
			return err
		}
	}
	initLogCount()

	dj := defaultJadwal()
	data, err := os.ReadFile(jadwalFile)
	if err != nil {
		logMsg("jadwal.json tidak ditemukan, membuat default")
		return saveJadwal(dj)
	}
	var j ModeJadwal
	if err := json.Unmarshal(data, &j); err != nil || j == nil {
		logMsg("jadwal.json tidak valid, menulis ulang")
		return saveJadwal(dj)
	}

	changed := false
	for _, m := range AllModes {
		if j[m] == nil {
			j[m] = dj[m]
			changed = true
		}
		for _, h := range AllHari {
			if j[m][h] == nil {
				j[m][h] = []Entry{}
				changed = true
			}
		}
	}
	if changed {
		return saveJadwal(j)
	}
	return nil
}

func listTones() ([]string, error) {
	entries, err := os.ReadDir(toneDir)
	if err != nil {
		return nil, err
	}
	var files []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ext := filepath.Ext(e.Name())
		if ext == ".mp3" || ext == ".wav" || ext == ".ogg" {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)
	return files, nil
}

func splitLogLines(data []byte) [][]byte {
	var lines [][]byte
	start := 0
	for i, b := range data {
		if b == '\n' {
			if line := data[start:i]; len(line) > 0 {
				lines = append(lines, line)
			}
			start = i + 1
		}
	}
	if start < len(data) {
		if line := data[start:]; len(line) > 0 {
			lines = append(lines, line)
		}
	}
	return lines
}

func initLogCount() {
	logMu.Lock()
	defer logMu.Unlock()
	data, err := os.ReadFile(logFile)
	if err != nil {
		logCount = 0
		return
	}
	lines := splitLogLines(data)
	logCount = len(lines)
	if logCount > logRotateAt {
		rotateLogLocked(lines)
	}
}

func rotateLogLocked(lines [][]byte) {
	if len(lines) <= maxLogLines {
		logCount = len(lines)
		return
	}
	trimmed := lines[len(lines)-maxLogLines:]
	var buf bytes.Buffer
	for _, l := range trimmed {
		buf.Write(l)
		buf.WriteByte('\n')
	}
	if err := atomicWrite(logFile, buf.Bytes(), 0644); err != nil {
		logMsg("gagal rotasi log: " + err.Error())
		return
	}
	logCount = maxLogLines
}

func writeLog(entry ActivityLog) {
	logMu.Lock()
	defer logMu.Unlock()

	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	line, _ := json.Marshal(entry)
	_, _ = f.Write(append(line, '\n'))
	_ = f.Close()

	logCount++
	if logCount > logRotateAt {
		data, err := os.ReadFile(logFile)
		if err != nil {
			return
		}
		rotateLogLocked(splitLogLines(data))
	}
}

func resetLog() error {
	logMu.Lock()
	defer logMu.Unlock()
	if err := os.WriteFile(logFile, []byte{}, 0644); err != nil {
		return err
	}
	logCount = 0
	return nil
}

func readLog() ([]ActivityLog, error) {
	logMu.Lock()
	defer logMu.Unlock()

	data, err := os.ReadFile(logFile)
	if err != nil {
		if os.IsNotExist(err) {
			return []ActivityLog{}, nil
		}
		return nil, err
	}

	lines := splitLogLines(data)
	var logs []ActivityLog
	for _, line := range lines {
		var l ActivityLog
		if json.Unmarshal(line, &l) == nil {
			logs = append(logs, l)
		}
	}

	if len(logs) > maxLogLines {
		logs = logs[len(logs)-maxLogLines:]
	}
	for i, j := 0, len(logs)-1; i < j; i, j = i+1, j-1 {
		logs[i], logs[j] = logs[j], logs[i]
	}
	return logs, nil
}

func defaultJadwal() ModeJadwal {
	b := toneDir
	j := make(ModeJadwal)
	for _, m := range AllModes {
		j[m] = map[string][]Entry{}
		for _, h := range AllHari {
			j[m][h] = []Entry{}
		}
	}
	j["reguler"]["Senin"] = []Entry{
		{Waktu: "06:44", Audio: b + "/sholawat.mp3"},
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/upacara.mp3"},
		{Waktu: "08:10", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:50", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:30", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "10:00", Audio: b + "/indonesia-raya.mp3"},
		{Waktu: "10:10", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "10:20", Audio: b + "/kebersihan.mp3"},
		{Waktu: "10:30", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "11:10", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:50", Audio: b + "/istirahat-2.mp3"},
		{Waktu: "12:30", Audio: b + "/kebersihan.mp3"},
		{Waktu: "12:40", Audio: b + "/pelajaran-7.mp3"},
		{Waktu: "13:20", Audio: b + "/pelajaran-8.mp3"},
		{Waktu: "14:00", Audio: b + "/pelajaran-9.mp3"},
		{Waktu: "14:40", Audio: b + "/pelajaran-10.mp3"},
		{Waktu: "15:20", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "15:21", Audio: b + "/tanah-airku.mp3"},
		{Waktu: "16:30", Audio: b + "/hymne-madrasah.mp3"},
	}
	j["reguler"]["Selasa"] = []Entry{
		{Waktu: "06:44", Audio: b + "/sholawat.mp3"},
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
		{Waktu: "08:10", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:50", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:30", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "10:10", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "10:20", Audio: b + "/kebersihan.mp3"},
		{Waktu: "10:30", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "11:10", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:50", Audio: b + "/istirahat-2.mp3"},
		{Waktu: "12:30", Audio: b + "/kebersihan.mp3"},
		{Waktu: "12:40", Audio: b + "/pelajaran-7.mp3"},
		{Waktu: "13:20", Audio: b + "/pelajaran-8.mp3"},
		{Waktu: "14:00", Audio: b + "/pelajaran-9.mp3"},
		{Waktu: "14:40", Audio: b + "/pelajaran-10.mp3"},
		{Waktu: "15:20", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "15:21", Audio: b + "/tanah-airku.mp3"},
		{Waktu: "16:30", Audio: b + "/hymne-madrasah.mp3"},
	}
	j["reguler"]["Rabu"] = copyEntries(j["reguler"]["Selasa"])
	j["reguler"]["Kamis"] = []Entry{
		{Waktu: "06:44", Audio: b + "/sholawat.mp3"},
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/literasi.mp3"},
		{Waktu: "08:10", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:50", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:30", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "10:00", Audio: b + "/indonesia-raya.mp3"},
		{Waktu: "10:10", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "10:20", Audio: b + "/kebersihan.mp3"},
		{Waktu: "10:30", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "11:10", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:50", Audio: b + "/istirahat-2.mp3"},
		{Waktu: "12:30", Audio: b + "/kebersihan.mp3"},
		{Waktu: "12:40", Audio: b + "/pelajaran-7.mp3"},
		{Waktu: "13:20", Audio: b + "/pelajaran-8.mp3"},
		{Waktu: "14:00", Audio: b + "/pelajaran-9.mp3"},
		{Waktu: "14:40", Audio: b + "/pelajaran-10.mp3"},
		{Waktu: "15:20", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "15:21", Audio: b + "/tanah-airku.mp3"},
		{Waktu: "16:30", Audio: b + "/hymne-madrasah.mp3"},
	}
	j["reguler"]["Jumat"] = []Entry{
		{Waktu: "06:44", Audio: b + "/sholawat.mp3"},
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/rohani.mp3"},
		{Waktu: "08:10", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "08:50", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "09:30", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "09:40", Audio: b + "/kebersihan.mp3"},
		{Waktu: "10:10", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "10:40", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:20", Audio: b + "/istirahat-2.mp3"},
		{Waktu: "12:50", Audio: b + "/pelajaran-7.mp3"},
		{Waktu: "13:30", Audio: b + "/pelajaran-8.mp3"},
		{Waktu: "14:10", Audio: b + "/akhir-pekan.mp3"},
		{Waktu: "14:11", Audio: b + "/tanah-airku.mp3"},
		{Waktu: "14:12", Audio: b + "/pramuka.mp3"},
		{Waktu: "16:00", Audio: b + "/hymne-madrasah.mp3"},
	}
	j["ramadhan"]["Senin"] = []Entry{
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/upacara.mp3"},
		{Waktu: "07:40", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:20", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:00", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "09:30", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "09:40", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "10:20", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:00", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "11:01", Audio: b + "/tanah-airku.mp3"},
	}
	j["ramadhan"]["Selasa"] = []Entry{
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:10", Audio: b + "/pelajaran-1.mp3"},
		{Waktu: "07:50", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:30", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:10", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "09:40", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "09:50", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "10:30", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:00", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "11:01", Audio: b + "/tanah-airku.mp3"},
	}
	j["ramadhan"]["Rabu"] = copyEntries(j["ramadhan"]["Selasa"])
	j["ramadhan"]["Kamis"] = []Entry{
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/literasi.mp3"},
		{Waktu: "07:40", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:20", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:00", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "09:30", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "09:40", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "10:20", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:00", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "11:01", Audio: b + "/tanah-airku.mp3"},
	}
	j["ramadhan"]["Jumat"] = []Entry{
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/rohani.mp3"},
		{Waktu: "07:40", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "08:20", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "09:00", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "09:10", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "09:50", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "10:20", Audio: b + "/akhir-pekan.mp3"},
		{Waktu: "10:21", Audio: b + "/tanah-airku.mp3"},
	}

	ptsEntry := func(hari string) []Entry {
		if hari == "Jumat" {
			return []Entry{
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
				{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
				{Waktu: "09:30", Audio: b + "/pelajaran-selesai.mp3"},
				{Waktu: "09:31", Audio: b + "/tanah-airku.mp3"},
			}
		}
		return []Entry{
			{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
			{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
			{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
			{Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"},
			{Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"},
			{Waktu: "10:31", Audio: b + "/tanah-airku.mp3"},
		}
	}
	for _, h := range []string{"Senin", "Selasa", "Rabu", "Kamis", "Jumat"} {
		j["pts"][h] = ptsEntry(h)
		j["pas"][h] = ptsEntry(h)
	}
	return j
}

```
---

## tsconfig.json
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}

```
---
