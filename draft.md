# SOURCE CODE

## astro.config.mjs
```js
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
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
BEL_TLS=0 # Set 1 jika pakai HTTPS
BEL_TRUST_PROXY=0 # Set 1 jika di balik reverse proxy (nginx)
BEL_ORIGINS=localhost:4321,localhost:3000 # Allowed CORS origins
BEL_ALSA_DEVICE=hw:1,0 # Set ALSA device for audio output (e.g., hw:1,0 for USB sound card)

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

func registerRoutes(mux *http.ServeMux) {
	registerPWARoutes(mux)
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

	mux.HandleFunc("/healthz", handleHealth)
	mux.HandleFunc("/login", handleLogin)
	mux.HandleFunc("/logout", handleLogout)
	mux.HandleFunc("/", requireAuth(handleIndex))

	mux.HandleFunc("/api/jadwal", requireAuth(handleJadwal))
	mux.HandleFunc("/api/jadwal/entry", requireAuth(handleJadwalEntry))
	mux.HandleFunc("/api/jadwal/day-toggle", requireAuth(handleJadwalDayToggle))

	mux.HandleFunc("/api/tones", requireAuth(handleTones))
	mux.HandleFunc("/api/tones/upload", requireAuth(handleTonesUpload))
	mux.HandleFunc("/api/tones/delete", requireAuth(handleTonesDelete))
	mux.HandleFunc("/api/tones/preview", requireAuth(handleTonesPreview))
	mux.HandleFunc("/api/tones/stop", requireAuth(handleTonesStop))
	mux.HandleFunc("/api/tones/file/", requireAuth(handleTonesFile))

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

func handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
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

	url := "https://api-harilibur.vercel.app/api?year=" + year
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
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
		if !strings.HasPrefix(cleanAudio, toneDir) {
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
			"url":      "/api/tones/file/" + name,
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
		if n, err := strconv.Atoi(pp); err == nil && n > 0 && n <= 100 {
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

	name := strings.TrimPrefix(r.URL.Path, "/api/tones/file/")
	filename, ok := safeFilename(name)
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
		"url":      "/api/tones/file/" + filename,
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
				if !strings.HasPrefix(clean, toneDir) {
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
	if err != nil || cfg.Volume == 0 {
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
	if v := os.Getenv("BEL_ORIGINS"); v != "" {
		var origins []string
		for _, o := range strings.Split(v, ",") {
			o = strings.TrimSpace(o)
			if o != "" {
				origins = append(origins, o)
			}
		}
		return origins
	}
	return []string{
		"http://localhost:4321",
		"http://localhost:3000",
		"http://127.0.0.1:4321",
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
allowBuilds:
  esbuild: set this to true or false
  sharp: set this to true or false
minimumReleaseAgeExclude:
  - '@astrojs/markdown-satteri@0.3.2'
  - astro@7.0.2

```
---

## public/manifest.json
```json
{
  "name": "Bel Madrasah",
  "short_name": "Bel",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0d1117",
  "theme_color": "#0969da",
  "icons": [
    {
      "src": "/icons/192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}

```
---

## public/sw.js
```js
const CACHE = "bel-v1";
const STATIC = ["/", "/login", "/jadwal", "/audio", "/libur", "/log", "/settings"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(
        () =>
          new Response('{"error":"offline"}', { headers: { "Content-Type": "application/json" } })
      )
    );
    return;
  }
  e.respondWith(caches.match(e.request).then((cached) => cached ?? fetch(e.request)));
});

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

## src/components/audio/AudioPage.tsx
```tsx

```
---

## src/components/audio/ToneList.tsx
```tsx

```
---

## src/components/audio/ToneRow.tsx
```tsx

```
---

## src/components/audio/UploadZone.tsx
```tsx

```
---

## src/components/audio/VolumeSlider.tsx
```tsx

```
---

## src/components/dashboard/ModeCard.tsx
```tsx

```
---

## src/components/dashboard/NowPlayingCard.tsx
```tsx

```
---

## src/components/dashboard/QuickActions.tsx
```tsx

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

```
---

## src/components/jadwal/EntryRow.tsx
```tsx

```
---

## src/components/jadwal/HariSection.tsx
```tsx

```
---

## src/components/jadwal/JadwalPage.tsx
```tsx

```
---

## src/components/jadwal/ModeTabs.tsx
```tsx

```
---

## src/components/layout/InstallPrompt.tsx
```tsx
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/Button";

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show) return null;

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

```
---

## src/components/layout/Shell.tsx
```tsx
import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./Sidebar";
import { InstallPrompt } from "./InstallPrompt";
import { initTheme } from "../../lib/theme";

export function Shell({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    initTheme();
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {!isMobile && <Sidebar expanded={expanded} onToggle={() => setExpanded((v) => !v)} />}
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
        <TopBar onMenuToggle={() => setExpanded((v) => !v)} isMobile={isMobile} />
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
import React from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Music2,
  CalendarOff,
  ScrollText,
  Settings2,
  ChevronRight,
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
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 10,
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
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
        {expanded && (
          <span
            style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", color: "var(--text)" }}
          >
            Bel Madrasah
          </span>
        )}
      </div>

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
              {expanded && label}
            </a>
          );
        })}
      </nav>

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
        }}
      >
        <ChevronRight
          size={16}
          style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}
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
import React, { useEffect, useState } from "react";
import { Sun, Moon, Menu } from "lucide-react";
import { getTheme, toggleTheme } from "../../lib/theme";

interface TopBarProps {
  onMenuToggle: () => void;
  isMobile: boolean;
}

export function TopBar({ onMenuToggle, isMobile }: TopBarProps) {
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
          <button
            onClick={onMenuToggle}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "flex",
              padding: 4,
            }}
          >
            <Menu size={20} />
          </button>
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

```
---

## src/components/libur/LiburModal.tsx
```tsx

```
---

## src/components/libur/LiburPage.tsx
```tsx

```
---

## src/components/log/LogPage.tsx
```tsx

```
---

## src/components/pengaturan/PengaturanPage.tsx
```tsx

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

async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const isFormData = body instanceof FormData;
  const res = await fetch(BASE + path, {
    method,
    credentials: "include",
    headers: isFormData ? undefined : body ? { "Content-Type": "application/json" } : undefined,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    return undefined as T;
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

```
---

## src/pages/index.astro
```astro
---

---

<html lang="en">
	<head>
		<meta charset="utf-8" />
		<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
		<link rel="icon" href="/favicon.ico" />
		<meta name="viewport" content="width=device-width" />
		<meta name="generator" content={Astro.generator} />
		<title>Astro</title>
	</head>
	<body>
		<h1>Astro</h1>
	</body>
</html>

```
---

## src/pages/login.astro
```astro

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
	j["reguler"]["Rabu"] = j["reguler"]["Selasa"]
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
	j["ramadhan"]["Rabu"] = j["ramadhan"]["Selasa"]
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
		e := []Entry{
			{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
			{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
			{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
			{Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"},
			{Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"},
			{Waktu: "10:31", Audio: b + "/tanah-airku.mp3"},
		}
		if hari == "Jumat" {
			return []Entry{
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
				{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
				{Waktu: "09:30", Audio: b + "/pelajaran-selesai.mp3"},
				{Waktu: "09:31", Audio: b + "/tanah-airku.mp3"},
			}
		}
		return e
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
