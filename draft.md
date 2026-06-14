# SOURCE CODE

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
		hash, err := hashPassword("admin123")
		if err != nil {
			return err
		}
		u := User{Username: "admin", PasswordHash: hash}
		data, err := json.MarshalIndent(u, "", "  ")
		if err != nil {
			return err
		}
		if err := os.WriteFile(usersFile, data, 0600); err != nil {
			return err
		}
		logMsg("akun admin default dibuat — username: admin | password: admin123")
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
			if now.After(a.lockUntil) && a.count < maxLoginFails {
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
	sessions[token] = &Session{Username: username, ExpiresAt: time.Now().Add(sessionTimeout)}
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
	if xf := r.Header.Get("X-Forwarded-For"); xf != "" {
		parts := strings.Split(xf, ",")
		return strings.TrimSpace(parts[0])
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
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

var validModes = map[string]bool{"reguler": true, "ramadhan": true, "pts": true, "pas": true}

var secureCookie = os.Getenv("BEL_TLS") == "1"

func registerRoutes(mux *http.ServeMux) {
	registerPWARoutes(mux)
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))
	mux.HandleFunc("/healthz", handleHealth)
	mux.HandleFunc("/login", handleLogin)
	mux.HandleFunc("/logout", handleLogout)
	mux.HandleFunc("/", requireAuth(handleIndex))
	mux.HandleFunc("/api/jadwal", requireAuth(handleJadwal))
	mux.HandleFunc("/api/jadwal/hari", requireAuth(handleJadwalHari))
	mux.HandleFunc("/api/jadwal/entry", requireAuth(handleJadwalEntry))
	mux.HandleFunc("/api/tones", requireAuth(handleTones))
	mux.HandleFunc("/api/tones/upload", requireAuth(handleTonesUpload))
	mux.HandleFunc("/api/tones/delete", requireAuth(handleTonesDelete))
	mux.HandleFunc("/api/tones/preview", requireAuth(handleTonesPreview))
	mux.HandleFunc("/api/config", requireAuth(handleConfig))
	mux.HandleFunc("/api/libur", requireAuth(handleLibur))
	mux.HandleFunc("/api/log", requireAuth(handleLog))
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
			jsonError(w, fmt.Sprintf("terlalu banyak percobaan gagal, coba lagi dalam %d menit", int(remaining.Minutes())+1), http.StatusTooManyRequests)
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
	user, err := loadUser()
	if err != nil {
		jsonError(w, "gagal memuat data user", http.StatusInternalServerError)
		return
	}
	if !verifyPassword(user.PasswordHash, body.OldPassword) {
		jsonError(w, "password lama salah", http.StatusUnauthorized)
		return
	}
	if len(body.NewPassword) < 6 {
		jsonError(w, "password baru minimal 6 karakter", http.StatusBadRequest)
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
			dates = []string{}
		}
		sort.Strings(dates)
		jsonOK(w, map[string]any{"libur": dates})
	case http.MethodPost:
		var body struct {
			Action string `json:"action"`
			Date   string `json:"date"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonError(w, "request tidak valid", http.StatusBadRequest)
			return
		}
		if _, err := time.Parse("2006-01-02", body.Date); err != nil {
			jsonError(w, "format tanggal tidak valid (YYYY-MM-DD)", http.StatusBadRequest)
			return
		}
		cfg, err := loadConfig()
		if err != nil {
			jsonError(w, "gagal memuat config", http.StatusInternalServerError)
			return
		}
		switch body.Action {
		case "add":
			for _, d := range cfg.LiburDates {
				if d == body.Date {
					jsonError(w, "tanggal sudah ada", http.StatusBadRequest)
					return
				}
			}
			cfg.LiburDates = append(cfg.LiburDates, body.Date)
		case "delete":
			n := cfg.LiburDates[:0]
			for _, d := range cfg.LiburDates {
				if d != body.Date {
					n = append(n, d)
				}
			}
			cfg.LiburDates = n
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
	mj := j[mode]
	if mj == nil {
		mj = map[string][]Entry{}
	}
	days := make([]string, 0, len(mj))
	for d := range mj {
		days = append(days, d)
	}
	sort.Strings(days)
	jsonOK(w, map[string]any{"jadwal": mj, "hari": days, "mode": mode})
}

func handleJadwalHari(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		Action string `json:"action"`
		Mode   string `json:"mode"`
		Hari   string `json:"hari"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if !validModes[body.Mode] {
		jsonError(w, "mode tidak valid", http.StatusBadRequest)
		return
	}
	body.Hari = strings.TrimSpace(body.Hari)
	if body.Hari == "" {
		jsonError(w, "nama hari tidak boleh kosong", http.StatusBadRequest)
		return
	}
	j, err := loadJadwal()
	if err != nil {
		jsonError(w, "gagal memuat jadwal", http.StatusInternalServerError)
		return
	}
	if j[body.Mode] == nil {
		j[body.Mode] = map[string][]Entry{}
	}
	switch body.Action {
	case "add":
		if _, exists := j[body.Mode][body.Hari]; exists {
			jsonError(w, "hari "+body.Hari+" sudah ada", http.StatusBadRequest)
			return
		}
		j[body.Mode][body.Hari] = []Entry{}
	case "delete":
		delete(j[body.Mode], body.Hari)
	default:
		jsonError(w, "action tidak valid", http.StatusBadRequest)
		return
	}
	if err := saveJadwal(j); err != nil {
		jsonError(w, "gagal menyimpan jadwal", http.StatusInternalServerError)
		return
	}
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
	files, err := listTones()
	if err != nil {
		jsonError(w, "gagal membaca direktori tone", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"tones": files})
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
	jsonOK(w, map[string]string{"message": "memutar " + filename})
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
		jsonError(w, "file terlalu besar", http.StatusBadRequest)
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "gagal membaca file", http.StatusBadRequest)
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		jsonError(w, "gagal membaca isi file", http.StatusInternalServerError)
		return
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		jsonError(w, "file tidak valid", http.StatusBadRequest)
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
		j[mode] = hm
	}
	for _, m := range []string{"reguler", "ramadhan", "pts", "pas"} {
		if j[m] == nil {
			j[m] = map[string][]Entry{}
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
	jsonOK(w, map[string]any{"running": running, "message": "scheduler " + state})
}

```
---

## install.sh
```bash
#!/bin/bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_URL="https://github.com/ZEDLABS-TEKNOLOGI-INDONESIA/bel-madrasah.git"
REPO_BRANCH="server"
BUILD_DIR="/tmp/bel-madrasah-build"
PROJECT_DIR="/opt/bel-madrasah"
SERVICE_NAME="bel-madrasah"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
GO_VERSION="1.24.4"

REQUIRED_ICON_SIZES=(72 96 128 144 152 192 384 512)
REQUIRED_MASKABLE_SIZES=(192 512)

ENABLE_TLS=0
DOMAIN=""
EMAIL=""
IS_UPDATE=0

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
cmd_exists() { command -v "$1" >/dev/null 2>&1; }

require_root() {
    [ "$EUID" -eq 0 ] || error "Jalankan sebagai root: sudo $0"
}

detect_pkg_manager() {
    if cmd_exists apt-get; then echo "apt"
    elif cmd_exists dnf; then echo "dnf"
    elif cmd_exists yum; then echo "yum"
    elif cmd_exists pacman; then echo "pacman"
    else error "Package manager tidak dikenali."
    fi
}

install_package() {
    local pkg="$1"
    local pm
    pm=$(detect_pkg_manager)
    info "Menginstall ${pkg}..."
    case "$pm" in
        apt)    apt-get update -qq && apt-get install -y "$pkg" ;;
        dnf)    dnf install -y "$pkg" ;;
        yum)    yum install -y "$pkg" ;;
        pacman) pacman -S --noconfirm "$pkg" ;;
    esac
}

install_go() {
    local arch
    case "$(uname -m)" in
        x86_64)        arch="amd64" ;;
        aarch64)       arch="arm64" ;;
        armv7l|armv6l) arch="armv6l" ;;
        riscv64)       arch="riscv64" ;;
        *) error "Arsitektur tidak didukung: $(uname -m)" ;;
    esac
    local tar_file="go${GO_VERSION}.linux-${arch}.tar.gz"
    local url="https://go.dev/dl/${tar_file}"
    info "Mengunduh Go ${GO_VERSION} (${arch})..."
    curl -fL --progress-bar -o "/tmp/${tar_file}" "$url" || error "Gagal mengunduh Go."
    rm -rf /usr/local/go
    tar -C /usr/local -xzf "/tmp/${tar_file}"
    rm -f "/tmp/${tar_file}"
    export PATH="$PATH:/usr/local/go/bin"
    mkdir -p /etc/profile.d
    echo 'export PATH=$PATH:/usr/local/go/bin' > /etc/profile.d/go.sh
    chmod 644 /etc/profile.d/go.sh
    cmd_exists go || error "Gagal menginstall Go."
    success "Go $(go version)"
}

check_requirements() {
    info "Memeriksa persyaratan sistem..."
    require_root
    if ! cmd_exists go; then
        warning "Go tidak ditemukan, menginstall otomatis..."
        install_go
    else
        success "Go: $(go version)"
    fi
    if ! cmd_exists git; then
        install_package git
    fi
    success "git: $(git --version)"
    cmd_exists systemctl || error "systemd tidak ditemukan."
    success "systemd tersedia."
}

install_tools() {
    for tool in ffmpeg curl; do
        if ! cmd_exists "$tool"; then
            install_package "$tool"
            cmd_exists "$tool" || error "Gagal menginstall ${tool}."
        fi
        success "${tool} tersedia."
    done
    if ! cmd_exists aplay; then
        install_package alsa-utils
        success "alsa-utils terinstall."
    else
        success "alsa-utils tersedia."
    fi
}

clone_repo() {
    info "Mengunduh source code..."
    rm -rf "$BUILD_DIR"
    git clone --depth=1 --branch "$REPO_BRANCH" "$REPO_URL" "$BUILD_DIR" \
        || error "Gagal clone repository."
    success "Source code diunduh ke ${BUILD_DIR}."
}

prepare_dirs() {
    info "Menyiapkan direktori proyek..."
    if [ -d "$PROJECT_DIR" ]; then
        IS_UPDATE=1
        warning "Instalasi sebelumnya ditemukan, melakukan update..."
        backup_data
    fi
    mkdir -p "${PROJECT_DIR}/tone" "${PROJECT_DIR}/data" "${PROJECT_DIR}/static/icons"
    success "Direktori siap: ${PROJECT_DIR}"
}

backup_data() {
    local ts
    ts=$(date +%Y%m%d-%H%M%S)
    local backup="/tmp/bel-madrasah-backup-${ts}"
    mkdir -p "$backup"
    [ -d "${PROJECT_DIR}/data" ]  && cp -r "${PROJECT_DIR}/data"  "${backup}/"
    [ -d "${PROJECT_DIR}/tone" ]  && cp -r "${PROJECT_DIR}/tone"  "${backup}/"
    success "Data di-backup ke: ${backup}"
}

build_binary() {
    info "Membangun binary..."
    local required_files=("main.go" "auth.go" "handler.go" "storage.go" "pwa.go" "go.mod")
    for f in "${required_files[@]}"; do
        [ -f "${BUILD_DIR}/${f}" ] || error "${f} tidak ditemukan di ${BUILD_DIR}."
    done
    (
        cd "$BUILD_DIR"
        go mod tidy
        CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "${PROJECT_DIR}/bel-madrasah" .
    ) || error "Gagal build binary."
    chmod +x "${PROJECT_DIR}/bel-madrasah"
    success "Binary: ${PROJECT_DIR}/bel-madrasah"
}

copy_static() {
    info "Menyalin file static..."
    if [ -d "${BUILD_DIR}/static" ]; then
        cp -r "${BUILD_DIR}/static/." "${PROJECT_DIR}/static/"
        success "Static files disalin."
    else
        warning "Direktori static tidak ditemukan."
    fi
    mkdir -p "${PROJECT_DIR}/static/icons"
}

generate_pwa_icons() {
    info "Memeriksa ikon PWA..."
    local missing=0
    for s in "${REQUIRED_ICON_SIZES[@]}"; do
        [ ! -f "${PROJECT_DIR}/static/icons/icon-${s}.png" ] && missing=1 && break
    done
    for s in "${REQUIRED_MASKABLE_SIZES[@]}"; do
        [ ! -f "${PROJECT_DIR}/static/icons/icon-maskable-${s}.png" ] && missing=1 && break
    done
    [ "$missing" -eq 0 ] && success "Ikon PWA lengkap." && return
    local src=""
    for c in "${BUILD_DIR}/static/icons/source.png" "${BUILD_DIR}/icon-source.png"; do
        [ -f "$c" ] && src="$c" && break
    done
    if [ -z "$src" ]; then
        warning "Ikon sumber tidak ditemukan, lewati pembuatan ikon PWA."
        return
    fi
    if ! cmd_exists convert; then
        install_package imagemagick || true
    fi
    if ! cmd_exists convert; then
        warning "ImageMagick tidak tersedia, ikon PWA tidak dibuat."
        return
    fi
    info "Membuat ikon PWA dari ${src}..."
    for s in "${REQUIRED_ICON_SIZES[@]}"; do
        convert "$src" -resize "${s}x${s}" "${PROJECT_DIR}/static/icons/icon-${s}.png"
    done
    for s in "${REQUIRED_MASKABLE_SIZES[@]}"; do
        convert "$src" -resize "${s}x${s}" -gravity center -extent "${s}x${s}" \
            "${PROJECT_DIR}/static/icons/icon-maskable-${s}.png"
    done
    success "Ikon PWA dibuat."
}

prompt_tls() {
    echo
    read -rp "Aktifkan HTTPS dengan certbot? [y/N]: " -n 1; echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && return
    read -rp "Domain (contoh: bel.sekolah.sch.id): " DOMAIN
    DOMAIN="${DOMAIN// /}"
    [ -z "$DOMAIN" ] && warning "Domain kosong, HTTPS dilewati." && return
    read -rp "Email untuk Let's Encrypt (boleh kosong): " EMAIL
    EMAIL="${EMAIL// /}"
    warning "Pastikan DNS ${DOMAIN} sudah mengarah ke server ini."
    ENABLE_TLS=1
}

setup_nginx() {
    info "Mengkonfigurasi nginx..."
    cmd_exists nginx || install_package nginx
    local server_name="_"
    [ -n "$DOMAIN" ] && server_name="$DOMAIN"
    local conf="/etc/nginx/sites-available/bel-madrasah"
    local enabled="/etc/nginx/sites-enabled/bel-madrasah"
    cat > "$conf" <<EOF
server {
    listen 80;
    server_name ${server_name};
    client_max_body_size 32M;
    location /static/ {
        proxy_pass         http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        expires            7d;
        add_header         Cache-Control "public, immutable";
    }
    location /sw.js {
        proxy_pass         http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        add_header         Cache-Control "no-cache";
    }
    location / {
        proxy_pass         http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
EOF
    ln -sf "$conf" "$enabled"
    [ -L /etc/nginx/sites-enabled/default ] && rm -f /etc/nginx/sites-enabled/default
    nginx -t 2>/dev/null || error "Konfigurasi nginx tidak valid."
    systemctl enable --now nginx
    systemctl reload nginx
    success "nginx dikonfigurasi."
}

setup_tls() {
    [ "$ENABLE_TLS" -ne 1 ] && return
    info "Mengaktifkan HTTPS untuk ${DOMAIN}..."
    if ! cmd_exists certbot; then
        local pm
        pm=$(detect_pkg_manager)
        case "$pm" in
            apt) apt-get install -y certbot python3-certbot-nginx ;;
            dnf|yum) "${pm}" install -y certbot python3-certbot-nginx ;;
            *) warning "Install certbot manual lalu jalankan: certbot --nginx -d ${DOMAIN}"; ENABLE_TLS=0; return ;;
        esac
    fi
    cmd_exists certbot || { warning "certbot tidak tersedia, HTTPS dilewati."; ENABLE_TLS=0; return; }
    local args=(--nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect)
    [ -n "$EMAIL" ] && args+=(-m "$EMAIL") || args+=(--register-unsafely-without-email)
    if certbot "${args[@]}"; then
        success "HTTPS aktif: https://${DOMAIN}"
        systemctl enable --now certbot.timer 2>/dev/null || true
    else
        warning "Gagal mengaktifkan HTTPS, aplikasi tetap berjalan via HTTP."
        ENABLE_TLS=0
    fi
}

create_service() {
    info "Membuat systemd service..."
    local tls_env=""
    [ "$ENABLE_TLS" -eq 1 ] && tls_env="Environment=BEL_TLS=1"
    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Bel Madrasah Otomatis
After=sound.target network.target
Wants=sound.target

[Service]
Type=simple
ExecStart=${PROJECT_DIR}/bel-madrasah
Restart=on-failure
RestartSec=10
User=root
SupplementaryGroups=audio
${tls_env}
StandardOutput=journal
StandardError=journal
WorkingDirectory=${PROJECT_DIR}
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${PROJECT_DIR}/data ${PROJECT_DIR}/tone
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    success "Service terdaftar dan diaktifkan."
}

copy_audio() {
    info "Menyalin file audio..."
    mkdir -p "${PROJECT_DIR}/tone"
    local count=0
    if [ -d "${BUILD_DIR}/tone" ]; then
        for f in "${BUILD_DIR}/tone/"*.mp3 "${BUILD_DIR}/tone/"*.wav "${BUILD_DIR}/tone/"*.ogg; do
            [ -f "$f" ] || continue
            cp "$f" "${PROJECT_DIR}/tone/"
            success "$(basename "$f")"
            ((count++)) || true
        done
    fi
    if [ "$count" -eq 0 ]; then
        warning "Tidak ada file audio. Unduh manual dari:"
        warning "https://github.com/ZEDLABS-TEKNOLOGI-INDONESIA/bel-madrasah/tree/${REPO_BRANCH}/tone"
    else
        info "${count} file audio disalin."
    fi
}

copy_uninstaller() {
    if [ -f "${BUILD_DIR}/uninstall.sh" ]; then
        cp "${BUILD_DIR}/uninstall.sh" "${PROJECT_DIR}/uninstall.sh"
        chmod +x "${PROJECT_DIR}/uninstall.sh"
        success "Uninstaller disalin."
    fi
}

set_permissions() {
    info "Mengatur izin file..."
    chown -R root:root "$PROJECT_DIR"
    chmod 755 "$PROJECT_DIR"
    chmod 750 "${PROJECT_DIR}/data"
    chmod 755 "${PROJECT_DIR}/tone" "${PROJECT_DIR}/static" "${PROJECT_DIR}/static/icons"
    chmod 755 "${PROJECT_DIR}/bel-madrasah"
    find "${PROJECT_DIR}/tone" -type f \( -name "*.mp3" -o -name "*.wav" -o -name "*.ogg" \) -exec chmod 644 {} +
    find "${PROJECT_DIR}/static" -type f -exec chmod 644 {} +
    [ -f "${PROJECT_DIR}/uninstall.sh" ] && chmod 755 "${PROJECT_DIR}/uninstall.sh"
    success "Izin file diatur."
}

verify_installation() {
    info "Memverifikasi instalasi..."
    [ -f "${PROJECT_DIR}/bel-madrasah" ]     && success "Binary ditemukan."       || error "Binary tidak ditemukan."
    [ -f "${PROJECT_DIR}/static/index.html" ] && success "index.html ditemukan."  || warning "index.html tidak ditemukan."
    systemctl is-enabled "${SERVICE_NAME}" >/dev/null 2>&1 \
        && success "Service terdaftar di systemd." || error "Service belum diaktifkan."
}

start_service() {
    info "Menjalankan service..."
    if [ "$IS_UPDATE" -eq 1 ] && systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl restart "$SERVICE_NAME"
    else
        systemctl start "$SERVICE_NAME"
    fi
    sleep 2
    systemctl is-active --quiet "$SERVICE_NAME" && success "Service berjalan." || {
        error "Service gagal berjalan. Cek log: journalctl -u ${SERVICE_NAME} -n 50"
    }
}

cleanup() {
    rm -rf "$BUILD_DIR"
    success "Build directory dihapus."
}

show_summary() {
    local local_ip
    local_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    local action="INSTALASI"
    [ "$IS_UPDATE" -eq 1 ] && action="UPDATE"
    echo
    echo "========================================="
    success "${action} SELESAI"
    echo "========================================="
    echo
    info "Direktori : ${PROJECT_DIR}"
    info "Service   : ${SERVICE_NAME}"
    if [ "$ENABLE_TLS" -eq 1 ]; then
        info "Akses     : https://${DOMAIN}"
    elif [ -n "$local_ip" ]; then
        info "Akses     : http://${local_ip}"
    fi
    if [ "$IS_UPDATE" -eq 0 ]; then
        info "Login     : admin / admin123"
        warning "Segera ganti password setelah login pertama!"
    fi
    echo
    echo "Perintah pengelolaan:"
    echo "  sudo systemctl status  ${SERVICE_NAME}"
    echo "  sudo systemctl stop    ${SERVICE_NAME}"
    echo "  sudo systemctl start   ${SERVICE_NAME}"
    echo "  sudo systemctl restart ${SERVICE_NAME}"
    echo "  sudo journalctl -u ${SERVICE_NAME} -f"
    echo
    [ -f "${PROJECT_DIR}/uninstall.sh" ] && echo "Untuk menghapus: sudo ${PROJECT_DIR}/uninstall.sh"
    echo
}

main() {
    echo "========================================="
    echo " Bel Madrasah - Installer"
    echo " ZEDLABS Teknologi Indonesia"
    echo "========================================="
    echo
    read -rp "Lanjutkan instalasi? [y/N]: " -n 1; echo
    [[ $REPLY =~ ^[Yy]$ ]] || { info "Instalasi dibatalkan."; exit 0; }
    echo
    check_requirements
    install_tools
    clone_repo
    prepare_dirs
    build_binary
    copy_static
    generate_pwa_icons
    prompt_tls
    setup_nginx
    setup_tls
    create_service
    copy_audio
    copy_uninstaller
    set_permissions
    verify_installation
    start_service
    cleanup
    show_summary
}

main "$@"

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
	port      = ":8081"
	toneDir   = "/opt/bel-madrasah/tone"
	dataDir   = "/opt/bel-madrasah/data"
	staticDir = "/opt/bel-madrasah/static"
	volume    = "0.85"
	sleepSec  = 20 * time.Second
)

var (
	ffmpegPath string

	activeProcs []*exec.Cmd
	procMu      sync.Mutex

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
	}
	return days[time.Now().Weekday()]
}

func stopAllProcs() {
	procMu.Lock()
	procs := activeProcs
	activeProcs = nil
	procMu.Unlock()
	for _, p := range procs {
		if p.ProcessState == nil {
			_ = p.Process.Kill()
			_ = p.Wait()
		}
	}
	time.Sleep(200 * time.Millisecond)
}

func playSound(filePath string) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		logMsg("file tidak ditemukan: " + filePath)
		return
	}
	stopAllProcs()
	cmd := exec.Command(ffmpegPath,
		"-hide_banner", "-loglevel", "error",
		"-i", filePath,
		"-filter:a", "volume="+volume,
		"-f", "alsa", "default",
	)
	if err := cmd.Start(); err != nil {
		logMsg("gagal memutar audio: " + err.Error())
		return
	}
	procMu.Lock()
	activeProcs = append(activeProcs, cmd)
	procMu.Unlock()
	go func() {
		_ = cmd.Wait()
		procMu.Lock()
		alive := activeProcs[:0]
		for _, p := range activeProcs {
			if p.ProcessState == nil {
				alive = append(alive, p)
			}
		}
		activeProcs = alive
		procMu.Unlock()
	}()
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
	for {
		select {
		case <-stop:
			logMsg("scheduler dihentikan")
			return
		default:
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
		if hari == "" {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}
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
				playSound(e.Audio)
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
	for _, p := range []string{"/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/bin/ffmpeg"} {
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
	srv := &http.Server{
		Addr:              port,
		Handler:           mux,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      30 * time.Second,
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

## static/index.html
```html
<!DOCTYPE html>
<html lang="id">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Bel Madrasah</title>
  <meta name="description" content="Sistem bel otomatis MTsN 1 Pandeglang">
  <meta name="theme-color" content="#1a0a00">
  <meta name="color-scheme" content="light">
  <link rel="manifest" href="/static/manifest.json">
  <link rel="icon" href="/static/icons/icon-192.png">
  <link rel="apple-touch-icon" href="/static/icons/icon-192.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Bel Madrasah">
  <meta name="mobile-web-app-capable" content="yes">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/static/style.css">
</head>

<body>

  <div class="splash" id="splash">
    <div class="splash-inner">
      <div class="splash-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <span class="splash-label">Bel Madrasah</span>
      <div class="splash-spinner"></div>
    </div>
  </div>

  <div class="offline-bar" id="offlineBar">Tidak ada koneksi ke server</div>

  <header class="topbar">
    <div class="topbar-brand">
      <div class="topbar-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <div class="topbar-title">
        <span class="topbar-name">Bel Madrasah</span>
        <span class="topbar-sub">MTsN 1 Pandeglang</span>
      </div>
    </div>
    <div class="topbar-right">
      <div class="status-cluster">
        <span class="mode-chip" id="modeChip">Reguler</span>
        <span class="libur-chip" id="liburChip">Libur</span>
        <div class="status-pill">
          <span class="status-dot" id="statusDot"></span>
          <span class="status-text" id="statusText">—</span>
        </div>
      </div>
      <button class="top-btn top-btn-accent" id="toggleBtn">—</button>
      <button class="top-btn" id="logoutBtn">Keluar</button>
    </div>
  </header>

  <div class="layout">

    <aside class="sidebar">
      <nav class="sidebar-nav">
        <button class="sidenav active" data-tab="jadwal">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span>Jadwal</span>
        </button>
        <button class="sidenav" data-tab="mode">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
          </svg>
          <span>Mode Bel</span>
        </button>
        <button class="sidenav" data-tab="libur">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
            <path d="M9 16l2 2 4-4" />
          </svg>
          <span>Hari Libur</span>
        </button>
        <button class="sidenav" data-tab="log">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span>Log</span>
        </button>
        <button class="sidenav" data-tab="audio">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span>Audio</span>
        </button>
        <button class="sidenav" data-tab="settings">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>Pengaturan</span>
        </button>
      </nav>
    </aside>

    <main class="main-content">

      <section class="page active" id="page-jadwal">
        <h2 class="page-title">Jadwal Bel</h2>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Mode Pembelajaran</div>
              <div class="card-desc">Pilih mode untuk melihat dan mengelola jadwal</div>
            </div>
          </div>
          <div class="tab-strip" id="modeTabStrip">
            <button class="mode-tab active" data-mode="reguler">Reguler</button>
            <button class="mode-tab" data-mode="ramadhan">Ramadhan</button>
            <button class="mode-tab" data-mode="pts">PTS</button>
            <button class="mode-tab" data-mode="pas">PAS</button>
          </div>
          <div class="add-row">
            <div class="field-group">
              <label>Tambah Hari</label>
              <input type="text" id="newHariInput" placeholder="Contoh: Sabtu">
            </div>
            <button class="btn btn-primary" id="addHariBtn">Tambah</button>
          </div>
          <div class="hari-strip" id="hariStrip"></div>
        </div>

        <div class="card" id="jadwalCard">
          <div class="card-header">
            <div>
              <div class="card-title" id="jadwalTitle">Pilih hari</div>
              <div class="card-desc" id="jadwalDesc">Pilih hari dari tab di atas</div>
            </div>
            <div class="btn-group" id="jadwalActions" style="display:none">
              <button class="btn btn-ghost btn-sm" id="deleteHariBtn">Hapus Hari</button>
              <button class="btn btn-primary btn-sm" id="addEntryBtn">Tambah Bel</button>
            </div>
          </div>
          <div id="jadwalBody">
            <div class="empty-state">Pilih hari untuk melihat jadwal bel</div>
          </div>
        </div>
      </section>

      <section class="page" id="page-mode">
        <h2 class="page-title">Mode Bel</h2>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Mode Aktif</div>
              <div class="card-desc">Pilih mode saat override manual diaktifkan</div>
            </div>
          </div>
          <div class="mode-grid">
            <div class="mode-card" id="mcard-reguler" data-mode="reguler">
              <div class="mode-card-dot"></div>
              <div class="mode-card-name">Reguler</div>
              <div class="mode-card-hint">Jadwal harian normal</div>
            </div>
            <div class="mode-card" id="mcard-ramadhan" data-mode="ramadhan">
              <div class="mode-card-dot"></div>
              <div class="mode-card-name">Ramadhan</div>
              <div class="mode-card-hint">Jadwal bulan Ramadhan</div>
            </div>
            <div class="mode-card" id="mcard-pts" data-mode="pts">
              <div class="mode-card-dot"></div>
              <div class="mode-card-name">PTS</div>
              <div class="mode-card-hint">Penilaian Tengah Semester</div>
            </div>
            <div class="mode-card" id="mcard-pas" data-mode="pas">
              <div class="mode-card-dot"></div>
              <div class="mode-card-name">PAS</div>
              <div class="mode-card-hint">Penilaian Akhir Semester</div>
            </div>
          </div>
          <div class="toggle-row">
            <div>
              <div class="toggle-label">Override Manual</div>
              <div class="toggle-hint">Paksa mode di atas, abaikan jadwal otomatis berbasis tanggal</div>
            </div>
            <label class="switch">
              <input type="checkbox" id="overrideToggle">
              <span class="switch-track"></span>
            </label>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Jadwal Otomatis Ramadhan</div>
              <div class="card-desc">Format MM-DD, berlaku setiap tahun</div>
            </div>
          </div>
          <div class="two-col">
            <div class="field-group">
              <label>Mulai</label>
              <input type="date" id="ramadhanStart">
            </div>
            <div class="field-group">
              <label>Akhir</label>
              <input type="date" id="ramadhanEnd">
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Jadwal Otomatis PTS</div>
              <div class="card-desc">Diprioritaskan di atas Ramadhan jika tanggal tumpang tindih</div>
            </div>
          </div>
          <div class="two-col">
            <div class="field-group">
              <label>Mulai PTS</label>
              <input type="date" id="ptsStart">
            </div>
            <div class="field-group">
              <label>Akhir PTS</label>
              <input type="date" id="ptsEnd">
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Jadwal Otomatis PAS</div>
              <div class="card-desc">Diprioritaskan di atas Ramadhan jika tanggal tumpang tindih</div>
            </div>
          </div>
          <div class="two-col">
            <div class="field-group">
              <label>Mulai PAS</label>
              <input type="date" id="pasStart">
            </div>
            <div class="field-group">
              <label>Akhir PAS</label>
              <input type="date" id="pasEnd">
            </div>
          </div>
          <div style="margin-top:20px">
            <button class="btn btn-primary" id="saveConfigBtn">Simpan Pengaturan</button>
          </div>
        </div>
      </section>

      <section class="page" id="page-libur">
        <h2 class="page-title">Hari Libur</h2>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Tambah Hari Libur</div>
              <div class="card-desc">Bel tidak akan berbunyi pada tanggal yang terdaftar</div>
            </div>
          </div>
          <div class="notice notice-warn">
            Scheduler akan melewati seluruh entri jadwal pada tanggal yang ditandai sebagai hari libur.
          </div>
          <div class="add-row">
            <div class="field-group">
              <label>Tanggal</label>
              <input type="date" id="newLiburDate">
            </div>
            <button class="btn btn-primary" id="addLiburBtn">Tambah</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Daftar Hari Libur</div>
            <span class="count-badge" id="liburCount">0</span>
          </div>
          <div id="liburList">
            <div class="empty-state">Memuat...</div>
          </div>
        </div>
      </section>

      <section class="page" id="page-log">
        <h2 class="page-title">Log Aktivitas</h2>
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Riwayat Bel</div>
              <div class="card-desc">Daftar bel yang telah diputar oleh scheduler</div>
            </div>
            <button class="btn btn-ghost btn-sm" id="refreshLogBtn">Perbarui</button>
          </div>
          <div id="logBody">
            <div class="empty-state">Memuat...</div>
          </div>
        </div>
      </section>

      <section class="page" id="page-audio">
        <h2 class="page-title">Manajemen Audio</h2>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Unggah File Audio</div>
              <div class="card-desc">Format yang didukung: MP3, WAV, OGG — Maks. 32 MB</div>
            </div>
          </div>
          <div class="upload-zone" id="uploadZone">
            <div class="upload-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
                <path d="M12 15V3m0 0-4 4m4-4 4 4M4 20h16" />
              </svg>
            </div>
            <p>Klik atau seret file audio ke sini</p>
            <small>MP3, WAV, OGG — Maks. 32 MB</small>
          </div>
          <input type="file" id="fileInput" accept=".mp3,.wav,.ogg">
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">Daftar File Audio</div>
            <span class="count-badge" id="toneCount">0</span>
          </div>
          <div id="toneList">
            <div class="empty-state">Memuat...</div>
          </div>
        </div>
      </section>

      <section class="page" id="page-settings">
        <h2 class="page-title">Pengaturan</h2>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Pasang Aplikasi</div>
              <div class="card-desc">Tambahkan ke layar utama untuk akses cepat tanpa browser</div>
            </div>
          </div>
          <button class="btn btn-primary" id="installAppBtn" style="display:none">Pasang Aplikasi</button>
          <p class="card-desc" id="installInfo">Aplikasi sudah terpasang atau tidak didukung di perangkat ini.</p>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Backup dan Restore</div>
              <div class="card-desc">Ekspor atau impor seluruh data jadwal dalam format JSON</div>
            </div>
          </div>
          <div class="btn-group">
            <button class="btn btn-success" id="backupBtn">Unduh Backup</button>
            <label class="btn btn-warn" style="cursor:pointer">
              Restore dari File
              <input type="file" accept=".json" id="restoreInput" style="display:none">
            </label>
          </div>
          <p class="card-desc" style="margin-top:12px">Mencakup jadwal reguler, Ramadhan, PTS, dan PAS.</p>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Ganti Password</div>
              <div class="card-desc">Minimal 6 karakter</div>
            </div>
          </div>
          <div class="field-group" style="margin-bottom:14px">
            <label>Password Lama</label>
            <input type="password" id="oldPass" placeholder="Password saat ini" autocomplete="current-password">
          </div>
          <div class="two-col" style="margin-bottom:18px">
            <div class="field-group">
              <label>Password Baru</label>
              <input type="password" id="newPass" placeholder="Min. 6 karakter" autocomplete="new-password">
            </div>
            <div class="field-group">
              <label>Konfirmasi</label>
              <input type="password" id="confirmPass" placeholder="Ulangi password baru" autocomplete="new-password">
            </div>
          </div>
          <button class="btn btn-primary" id="changePassBtn">Perbarui Password</button>
        </div>
      </section>

    </main>
  </div>

  <nav class="bottom-nav" id="bottomNav">
    <button class="botnav active" data-tab="jadwal">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <span>Jadwal</span>
    </button>
    <button class="botnav" data-tab="mode">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
      </svg>
      <span>Mode</span>
    </button>
    <button class="botnav" data-tab="libur">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="M9 16l2 2 4-4" />
      </svg>
      <span>Libur</span>
    </button>
    <button class="botnav" data-tab="log">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
      </svg>
      <span>Log</span>
    </button>
    <button class="botnav" data-tab="audio">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
      <span>Audio</span>
    </button>
    <button class="botnav" data-tab="settings">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
      <span>Setting</span>
    </button>
  </nav>

  <div class="modal-overlay" id="entryModal">
    <div class="modal">
      <div class="modal-header">
        <div>
          <div class="modal-title" id="modalTitle">Tambah Bel</div>
          <div class="modal-sub" id="modalSub"></div>
        </div>
        <button class="modal-close" id="cancelModalBtn">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="modal-body">
        <div class="field-group" style="margin-bottom:16px">
          <label>Waktu</label>
          <input type="time" id="entryWaktu">
        </div>
        <div class="field-group">
          <label>File Audio</label>
          <select id="entryAudio"></select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="cancelModalBtn2">Batal</button>
        <button class="btn btn-primary" id="saveEntryBtn">Simpan</button>
      </div>
    </div>
  </div>

  <div class="pwa-banner" id="pwaBanner">
    <div class="pwa-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
        <path d="M12 15V3m0 0-4 4m4-4 4 4M4 20h16" />
      </svg>
    </div>
    <div class="pwa-text">
      <div class="pwa-title">Pasang Bel Madrasah</div>
      <div class="pwa-desc">Tambahkan ke layar utama untuk akses cepat</div>
    </div>
    <div class="pwa-btns">
      <button class="btn btn-ghost btn-sm" id="dismissBannerBtn">Nanti</button>
      <button class="btn btn-primary btn-sm" id="installBannerBtn">Pasang</button>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script src="/static/script.js"></script>
</body>

</html>

```
---

## static/login.css
```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Lexend', system-ui, sans-serif;
  background: #1a0a00;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  -webkit-font-smoothing: antialiased;
}

.login-bg {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background:
    radial-gradient(ellipse at 20% 20%, rgba(180, 70, 0, .22) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 80%, rgba(100, 40, 0, .16) 0%, transparent 55%),
    #1a0a00;
}

.login-card {
  background: #fffaf4;
  border-radius: 20px;
  box-shadow: 0 40px 80px rgba(0, 0, 0, .5), 0 8px 24px rgba(0, 0, 0, .25);
  padding: 44px 40px;
  width: 100%;
  max-width: 400px;
  animation: cardIn .4s cubic-bezier(.34, 1.56, .64, 1) both;
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(.96);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

.login-brand {
  text-align: center;
  margin-bottom: 36px;
}

.login-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #fff3e6, #ffe0c0);
  border: 1px solid #ffc999;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 4px 12px rgba(194, 82, 0, .18);
}

.login-icon svg {
  width: 26px;
  height: 26px;
  stroke: #b84800;
}

.login-brand h1 {
  font-size: 18px;
  font-weight: 700;
  color: #1a0a00;
  letter-spacing: -.02em;
}

.login-brand p {
  font-size: 12px;
  color: #9a6840;
  margin-top: 4px;
  font-weight: 400;
}

.login-alert {
  display: none;
  background: #fff1ee;
  border: 1px solid #ffb3a0;
  color: #7a1400;
  border-radius: 10px;
  padding: 11px 14px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 20px;
  line-height: 1.45;
}

.login-alert.show {
  display: block;
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  font-size: 10.5px;
  font-weight: 600;
  color: #6b3a14;
  text-transform: uppercase;
  letter-spacing: .07em;
  margin-bottom: 7px;
}

.field input {
  width: 100%;
  padding: 11px 14px;
  border: 1.5px solid #e8d0b8;
  border-radius: 10px;
  font-size: 14px;
  font-family: inherit;
  color: #1a0a00;
  background: #fff;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
  -webkit-appearance: none;
}

.field input::placeholder {
  color: #c8a888;
}

.field input:focus {
  border-color: #b84800;
  box-shadow: 0 0 0 3px rgba(184, 72, 0, .12);
}

.btn-login {
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  background: linear-gradient(135deg, #c85200, #a03e00);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(184, 72, 0, .4);
  transition: opacity .2s, transform .1s, box-shadow .2s;
  letter-spacing: -.01em;
}

.btn-login:hover {
  opacity: .92;
  box-shadow: 0 6px 18px rgba(184, 72, 0, .48);
}

.btn-login:active {
  transform: scale(.98);
}

.btn-login:disabled {
  background: #d4b898;
  box-shadow: none;
  cursor: not-allowed;
}

.login-footer {
  text-align: center;
  font-size: 11px;
  color: #c0a080;
  margin-top: 24px;
  font-weight: 400;
}

@media (max-width: 420px) {
  .login-card {
    padding: 32px 24px;
  }
}

```
---

## static/login.html
```html
<!DOCTYPE html>
<html lang="id">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Masuk — Bel Madrasah</title>
  <meta name="theme-color" content="#1a0a00">
  <link rel="manifest" href="/static/manifest.json">
  <link rel="icon" href="/static/icons/icon-192.png">
  <link rel="apple-touch-icon" href="/static/icons/icon-192.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/static/login.css">
</head>

<body>
  <div class="login-bg">
    <div class="login-card">
      <div class="login-brand">
        <div class="login-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </div>
        <h1>Bel Madrasah</h1>
        <p>MTsN 1 Pandeglang</p>
      </div>
      <div class="login-alert" id="loginAlert"></div>
      <div class="field">
        <label for="username">Username</label>
        <input type="text" id="username" placeholder="Masukkan username" autocomplete="username" autofocus>
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input type="password" id="password" placeholder="Masukkan password" autocomplete="current-password">
      </div>
      <button class="btn-login" id="loginBtn">Masuk</button>
      <div class="login-footer">Sistem Bel Otomatis Madrasah</div>
    </div>
  </div>
  <script src="/static/login.js"></script>
</body>

</html>

```
---

## static/login.js
```text
(function () {
  var btn = document.getElementById("loginBtn");
  var alert = document.getElementById("loginAlert");

  function showAlert(msg) {
    alert.textContent = msg;
    alert.classList.add("show");
  }

  function hideAlert() {
    alert.classList.remove("show");
  }

  async function login() {
    var u = document.getElementById("username").value.trim();
    var p = document.getElementById("password").value;
    if (!u || !p) {
      showAlert("Username dan password harus diisi.");
      return;
    }
    btn.disabled = true;
    btn.textContent = "Memproses...";
    hideAlert();
    try {
      var res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = "/";
    } catch (e) {
      showAlert(e.message);
      btn.disabled = false;
      btn.textContent = "Masuk";
    }
  }

  btn.addEventListener("click", login);
  document.getElementById("password").addEventListener("keydown", function (e) {
    if (e.key === "Enter") login();
  });
  document.getElementById("username").addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("password").focus();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();

```
---

## static/manifest.json
```json
{
  "name": "Bel Madrasah Otomatis - MTsN 1 Pandeglang",
  "short_name": "Bel Madrasah",
  "description": "Aplikasi pengelolaan jadwal bel otomatis untuk MTsN 1 Pandeglang",
  "id": "/",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#f7f5f2",
  "theme_color": "#2c3e4f",
  "lang": "id-ID",
  "dir": "ltr",
  "categories": [
    "education",
    "productivity",
    "utilities"
  ],
  "icons": [
    {
      "src": "/static/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    }
  ],
  "shortcuts": [
    {
      "name": "Jadwal Bel",
      "short_name": "Jadwal",
      "url": "/?tab=jadwal",
      "description": "Lihat dan kelola jadwal bel"
    },
    {
      "name": "Log Aktivitas",
      "short_name": "Log",
      "url": "/?tab=log",
      "description": "Lihat riwayat aktivitas bel"
    },
    {
      "name": "Manajemen Audio",
      "short_name": "Audio",
      "url": "/?tab=tones",
      "description": "Kelola file audio bel"
    }
  ]
}

```
---

## static/offline.html
```html
<!DOCTYPE html>
<html lang="id">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#2c3e4f">
  <title>Offline - Bel Madrasah</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: linear-gradient(150deg, #2c3e4f 0%, #1e2c38 100%);
      color: #f3ede4;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .wrap {
      text-align: center;
      max-width: 380px;
    }

    .icon {
      width: 64px;
      height: 64px;
      border-radius: 18px;
      background: rgba(255, 255, 255, .08);
      border: 1px solid rgba(255, 255, 255, .12);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 22px;
    }

    .icon svg {
      width: 30px;
      height: 30px;
      stroke: #f3c98a;
    }

    h1 {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 19px;
      font-weight: 700;
      margin-bottom: 10px;
      letter-spacing: -.01em;
    }

    p {
      font-size: 13.5px;
      color: #b9c6d2;
      line-height: 1.6;
      margin-bottom: 24px;
    }

    button {
      font-family: inherit;
      background: #f3c98a;
      color: #2c3e4f;
      border: none;
      padding: 11px 24px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: opacity .15s;
    }

    button:hover {
      opacity: .9;
    }
  </style>
</head>

<body>
  <div class="wrap">
    <div class="icon">
      <svg fill="none" stroke-width="1.75" viewBox="0 0 24 24">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        <path d="M3 3l18 18" />
      </svg>
    </div>
    <h1>Tidak Ada Koneksi</h1>
    <p>Halaman ini tidak tersedia secara offline. Periksa koneksi jaringan ke server Bel Madrasah, lalu coba lagi.</p>
    <button onclick="window.location.reload()">Coba Lagi</button>
  </div>
</body>

</html>

```
---

## static/script.js
```text
var MODE_LABELS = { reguler: "Reguler", ramadhan: "Ramadhan", pts: "PTS", pas: "PAS" };
var DAY_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

var jadwalMode = "reguler";
var activeHari = null;
var editIndex = -1;
var allTones = [];
var jadwalData = {};
var configData = {};
var deferredPWA = null;

var MON_ID = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];
var DAY_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function $(id) {
  return document.getElementById(id);
}

/* ─── TOAST ─── */
function toast(msg, type) {
  var el = $("toast");
  el.textContent = msg;
  el.className = "toast show" + (type === "error" ? " error" : type === "ok" ? " ok" : "");
  clearTimeout(el._t);
  el._t = setTimeout(function () {
    el.className = "toast";
  }, 3000);
}

/* ─── API ─── */
async function api(url, method, body) {
  var opts = { method: method || "GET", headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  var res = await fetch(url, opts);
  var data = await res.json();
  if (!res.ok) throw new Error(data.error || "Terjadi kesalahan");
  return data;
}

/* ─── NAV ─── */
function switchTab(id) {
  document.querySelectorAll(".page").forEach(function (el) {
    el.classList.remove("active");
  });
  document.querySelectorAll(".sidenav, .botnav").forEach(function (el) {
    el.classList.remove("active");
  });
  $("page-" + id).classList.add("active");
  document.querySelectorAll('[data-tab="' + id + '"]').forEach(function (el) {
    el.classList.add("active");
  });
  if (id === "audio") loadTones();
  if (id === "log") loadLog();
  if (id === "libur") loadLibur();
  if (id === "mode") renderModeUI();
}

function setupNav() {
  document.querySelectorAll("[data-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      switchTab(btn.dataset.tab);
    });
  });
  document.querySelectorAll(".mode-tab").forEach(function (btn) {
    btn.addEventListener("click", function () {
      jadwalMode = btn.dataset.mode;
      activeHari = null;
      document.querySelectorAll(".mode-tab").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      loadJadwal();
    });
  });
  document.querySelectorAll(".mode-card").forEach(function (el) {
    el.addEventListener("click", function () {
      selectMode(el.dataset.mode);
    });
  });
}

/* ─── STATUS ─── */
async function loadStatus() {
  try {
    var d = await api("/api/service/status");
    var dot = $("statusDot");
    dot.className = "status-dot" + (d.running ? " on" : "");
    $("statusText").textContent = d.running ? "Aktif" : "Nonaktif";
    $("toggleBtn").textContent = d.running ? "Hentikan" : "Aktifkan";
    var mode = d.active_mode || "reguler";
    var chip = $("modeChip");
    chip.textContent = MODE_LABELS[mode] || mode;
    chip.className = "mode-chip " + mode;
    $("liburChip").className = "libur-chip" + (d.is_libur ? " show" : "");
  } catch (_) {}
}

async function toggleService() {
  try {
    var d = await api("/api/service/toggle", "POST");
    toast(d.message, "ok");
    loadStatus();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── CONFIG ─── */
async function loadConfig() {
  try {
    var d = await api("/api/config");
    configData = d.config;
  } catch (e) {
    toast(e.message, "error");
  }
}

function renderModeUI() {
  if (!configData.mode) return;
  var m = configData.mode;
  ["reguler", "ramadhan", "pts", "pas"].forEach(function (k) {
    var el = $("mcard-" + k);
    el.className = "mode-card" + (m === k ? " active" : "");
  });
  $("overrideToggle").checked = configData.manual_override;
  $("ramadhanStart").value = configData.ramadhan_start || "";
  $("ramadhanEnd").value = configData.ramadhan_end || "";
  $("ptsStart").value = configData.pts_start || "";
  $("ptsEnd").value = configData.pts_end || "";
  $("pasStart").value = configData.pas_start || "";
  $("pasEnd").value = configData.pas_end || "";
}

function selectMode(mode) {
  configData.mode = mode;
  renderModeUI();
}

async function saveConfig() {
  var start = $("ramadhanStart").value.trim();
  var end = $("ramadhanEnd").value.trim();
  var mmdd = /^\d{2}-\d{2}$/;
  if (start && !mmdd.test(start)) {
    toast("Format Ramadhan harus MM-DD", "error");
    return;
  }
  if (end && !mmdd.test(end)) {
    toast("Format Ramadhan harus MM-DD", "error");
    return;
  }
  try {
    await api("/api/config", "POST", {
      mode: configData.mode,
      manual_override: $("overrideToggle").checked,
      ramadhan_start: $("ramadhanStart").value,
      ramadhan_end: $("ramadhanEnd").value,
      pts_start: $("ptsStart").value,
      pts_end: $("ptsEnd").value,
      pas_start: $("pasStart").value,
      pas_end: $("pasEnd").value,
    });
    toast("Pengaturan disimpan", "ok");
    loadStatus();
    await loadConfig();
    renderModeUI();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── LIBUR ─── */
function fmtDate(d) {
  var parts = d.split("-");
  return (
    DAY_ID[new Date(d).getDay()] +
    ", " +
    parseInt(parts[2]) +
    " " +
    MON_ID[parseInt(parts[1])] +
    " " +
    parts[0]
  );
}

async function loadLibur() {
  try {
    var d = await api("/api/libur");
    var list = d.libur || [];
    $("liburCount").textContent = list.length;
    var c = $("liburList");
    if (!list.length) {
      c.innerHTML = '<div class="empty-state">Belum ada hari libur terdaftar</div>';
      return;
    }
    var today = new Date().toISOString().slice(0, 10);
    c.innerHTML = list
      .map(function (date) {
        var isTdy = date === today;
        return (
          '<div class="libur-item' +
          (isTdy ? " today" : "") +
          '">' +
          '<div class="libur-date">' +
          fmtDate(date) +
          (isTdy ? '<span class="today-tag">Hari Ini</span>' : "") +
          "</div>" +
          '<button class="btn btn-danger btn-sm" onclick="deleteLibur(\'' +
          date +
          "')\">Hapus</button>" +
          "</div>"
        );
      })
      .join("");
  } catch (e) {
    toast(e.message, "error");
  }
}

async function addLibur() {
  var date = $("newLiburDate").value;
  if (!date) {
    toast("Pilih tanggal terlebih dahulu", "error");
    return;
  }
  try {
    await api("/api/libur", "POST", { action: "add", date: date });
    toast("Tanggal libur ditambahkan", "ok");
    $("newLiburDate").value = "";
    loadLibur();
    loadStatus();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteLibur(date) {
  if (!confirm("Hapus " + fmtDate(date) + " dari daftar libur?")) return;
  try {
    await api("/api/libur", "POST", { action: "delete", date: date });
    toast("Tanggal libur dihapus", "ok");
    loadLibur();
    loadStatus();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── JADWAL ─── */
async function loadJadwal() {
  try {
    var d = await api("/api/jadwal?mode=" + jadwalMode);
    jadwalData = d.jadwal || {};
    renderHariStrip(Object.keys(jadwalData));
    if (activeHari && jadwalData[activeHari]) {
      renderJadwalTable(activeHari);
    } else {
      activeHari = null;
      $("jadwalTitle").textContent = "Pilih hari";
      $("jadwalDesc").textContent = "Pilih hari dari tab di atas";
      $("jadwalBody").innerHTML =
        '<div class="empty-state">Pilih hari untuk melihat jadwal bel</div>';
      $("jadwalActions").style.display = "none";
    }
  } catch (e) {
    toast(e.message, "error");
  }
}

function renderHariStrip(days) {
  var c = $("hariStrip");
  if (!days.length) {
    c.innerHTML =
      '<span style="font-size:12px;color:var(--c-ink4)">Belum ada hari. Tambahkan di atas.</span>';
    return;
  }
  days.sort(function (a, b) {
    var ai = DAY_ORDER.indexOf(a),
      bi = DAY_ORDER.indexOf(b);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  c.innerHTML = days
    .map(function (h) {
      return (
        '<button class="hari-tab' +
        (h === activeHari ? " active" : "") +
        '" onclick="selectHari(\'' +
        h +
        "')\">" +
        h +
        "</button>"
      );
    })
    .join("");
}

function selectHari(hari) {
  activeHari = hari;
  document.querySelectorAll(".hari-tab").forEach(function (b) {
    b.classList.toggle("active", b.textContent === hari);
  });
  renderJadwalTable(hari);
  $("jadwalActions").style.display = "";
}

function renderJadwalTable(hari) {
  $("jadwalTitle").textContent = hari + " \u2014 " + (MODE_LABELS[jadwalMode] || jadwalMode);
  var entries = jadwalData[hari] || [];
  $("jadwalDesc").textContent = entries.length + " entri bel";
  if (!entries.length) {
    $("jadwalBody").innerHTML =
      '<div class="empty-state">Belum ada jadwal bel untuk hari ini</div>';
    return;
  }
  var rows = entries
    .map(function (e, i) {
      return (
        "<tr>" +
        '<td class="td-num">' +
        (i + 1) +
        "</td>" +
        '<td class="td-time">' +
        e.waktu +
        "</td>" +
        '<td class="td-audio">' +
        e.audio.split("/").pop() +
        "</td>" +
        '<td><div class="btn-group">' +
        '<button class="btn btn-ghost btn-sm" onclick="openEditEntry(' +
        i +
        ')">Edit</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteEntry(' +
        i +
        ')">Hapus</button>' +
        "</div></td>" +
        "</tr>"
      );
    })
    .join("");
  $("jadwalBody").innerHTML =
    '<div class="table-wrap"><table>' +
    '<thead><tr><th style="width:32px">#</th><th>Waktu</th><th>Audio</th><th style="width:130px">Aksi</th></tr></thead>' +
    "<tbody>" +
    rows +
    "</tbody></table></div>";
}

async function addHari() {
  var input = $("newHariInput");
  var hari = input.value.trim();
  if (!hari) {
    toast("Nama hari tidak boleh kosong", "error");
    return;
  }
  try {
    await api("/api/jadwal/hari", "POST", { action: "add", mode: jadwalMode, hari: hari });
    toast("Hari " + hari + " ditambahkan", "ok");
    input.value = "";
    await loadJadwal();
    selectHari(hari);
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteHari() {
  if (!activeHari) return;
  if (!confirm("Hapus hari " + activeHari + " beserta seluruh jadwalnya?")) return;
  try {
    await api("/api/jadwal/hari", "POST", { action: "delete", mode: jadwalMode, hari: activeHari });
    toast("Hari " + activeHari + " dihapus", "ok");
    activeHari = null;
    await loadJadwal();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── ENTRY MODAL ─── */
function openAddEntry() {
  editIndex = -1;
  $("modalTitle").textContent = "Tambah Bel";
  $("modalSub").textContent = activeHari + " \u2014 " + (MODE_LABELS[jadwalMode] || jadwalMode);
  $("entryWaktu").value = "";
  fillAudioSelect("");
  $("entryModal").classList.add("open");
}

function openEditEntry(idx) {
  editIndex = idx;
  var e = jadwalData[activeHari][idx];
  $("modalTitle").textContent = "Edit Bel";
  $("modalSub").textContent = activeHari + " \u2014 " + (MODE_LABELS[jadwalMode] || jadwalMode);
  $("entryWaktu").value = e.waktu;
  fillAudioSelect(e.audio);
  $("entryModal").classList.add("open");
}

function fillAudioSelect(current) {
  var sel = $("entryAudio");
  sel.innerHTML = allTones
    .map(function (t) {
      var fp = "/opt/bel-madrasah/tone/" + t;
      return (
        '<option value="' + fp + '"' + (current === fp ? " selected" : "") + ">" + t + "</option>"
      );
    })
    .join("");
}

function closeModal() {
  $("entryModal").classList.remove("open");
}

async function saveEntry() {
  var waktu = $("entryWaktu").value;
  var audio = $("entryAudio").value;
  if (!waktu) {
    toast("Waktu harus diisi", "error");
    return;
  }
  if (!audio) {
    toast("Pilih file audio", "error");
    return;
  }
  var action = editIndex === -1 ? "add" : "edit";
  try {
    await api("/api/jadwal/entry", "POST", {
      action: action,
      mode: jadwalMode,
      hari: activeHari,
      index: editIndex,
      entry: { waktu: waktu, audio: audio },
    });
    toast(action === "add" ? "Bel ditambahkan" : "Bel diperbarui", "ok");
    closeModal();
    await loadJadwal();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteEntry(idx) {
  if (!confirm("Hapus entri bel ini?")) return;
  try {
    await api("/api/jadwal/entry", "POST", {
      action: "delete",
      mode: jadwalMode,
      hari: activeHari,
      index: idx,
      entry: {},
    });
    toast("Entri dihapus", "ok");
    await loadJadwal();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── LOG ─── */
async function loadLog() {
  var c = $("logBody");
  try {
    var d = await api("/api/log");
    var logs = d.logs || [];
    if (!logs.length) {
      c.innerHTML = '<div class="empty-state">Belum ada aktivitas tercatat</div>';
      return;
    }
    var rows = logs
      .map(function (l) {
        return (
          "<tr>" +
          '<td style="white-space:nowrap;color:var(--c-ink4);font-size:11.5px">' +
          l.time +
          "</td>" +
          '<td><span class="log-badge ' +
          l.mode +
          '">' +
          (MODE_LABELS[l.mode] || l.mode) +
          "</span></td>" +
          '<td style="font-size:13px">' +
          l.hari +
          "</td>" +
          '<td class="td-time">' +
          l.waktu +
          "</td>" +
          '<td class="td-audio">' +
          l.audio +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
    c.innerHTML =
      '<div class="table-wrap"><table>' +
      "<thead><tr><th>Waktu</th><th>Mode</th><th>Hari</th><th>Jam</th><th>Audio</th></tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody></table></div>";
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── AUDIO / TONES ─── */
async function loadTones() {
  try {
    var d = await api("/api/tones");
    allTones = d.tones || [];
    $("toneCount").textContent = allTones.length;
    var list = $("toneList");
    if (!allTones.length) {
      list.innerHTML = '<div class="empty-state">Belum ada file audio</div>';
      return;
    }
    list.innerHTML = allTones
      .map(function (f) {
        return (
          '<div class="tone-item">' +
          '<span class="tone-name">' +
          f +
          "</span>" +
          '<div class="btn-group">' +
          '<button class="btn btn-success btn-sm" onclick="previewTone(\'' +
          f +
          "')\">Putar</button>" +
          '<button class="btn btn-danger btn-sm" onclick="deleteTone(\'' +
          f +
          "')\">Hapus</button>" +
          "</div></div>"
        );
      })
      .join("");
  } catch (e) {
    toast(e.message, "error");
  }
}

async function uploadFile(file) {
  if (!file) return;
  var fd = new FormData();
  fd.append("file", file);
  try {
    toast("Mengunggah " + file.name + "...");
    var res = await fetch("/api/tones/upload", { method: "POST", body: fd });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast(data.message, "ok");
    $("fileInput").value = "";
    loadTones();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function previewTone(filename) {
  try {
    await api("/api/tones/preview", "POST", { filename: filename });
    toast("Memutar " + filename, "ok");
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteTone(filename) {
  if (!confirm("Hapus file " + filename + "?")) return;
  try {
    await api("/api/tones/delete", "POST", { filename: filename });
    toast(filename + " berhasil dihapus", "ok");
    loadTones();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── BACKUP / RESTORE ─── */
function downloadBackup() {
  window.location.href = "/api/backup";
}

async function restoreBackup(file) {
  if (!file) return;
  if (!confirm("Restore akan mengganti seluruh jadwal yang ada. Lanjutkan?")) return;
  var fd = new FormData();
  fd.append("file", file);
  try {
    toast("Merestore jadwal...");
    var res = await fetch("/api/restore", { method: "POST", body: fd });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast(data.message, "ok");
    await loadJadwal();
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── PASSWORD ─── */
async function changePassword() {
  var old = $("oldPass").value;
  var nw = $("newPass").value;
  var cf = $("confirmPass").value;
  if (nw !== cf) {
    toast("Konfirmasi password tidak cocok", "error");
    return;
  }
  if (nw.length < 6) {
    toast("Password baru minimal 6 karakter", "error");
    return;
  }
  try {
    var d = await api("/api/change-password", "POST", { old_password: old, new_password: nw });
    toast(d.message, "ok");
    ["oldPass", "newPass", "confirmPass"].forEach(function (id) {
      $(id).value = "";
    });
  } catch (e) {
    toast(e.message, "error");
  }
}

/* ─── OFFLINE ─── */
function setupOffline() {
  var bar = $("offlineBar");
  function update() {
    bar.classList.toggle("show", !navigator.onLine);
  }
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

/* ─── PWA ─── */
function setupPWA() {
  var banner = $("pwaBanner");
  var btn = $("installAppBtn");
  var info = $("installInfo");
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPWA = e;
    if (btn) {
      btn.style.display = "";
      if (info) info.style.display = "none";
    }
    if (banner)
      setTimeout(function () {
        banner.classList.add("show");
      }, 2000);
  });
  window.addEventListener("appinstalled", function () {
    deferredPWA = null;
    if (banner) banner.classList.remove("show");
    if (btn) btn.style.display = "none";
    if (info) {
      info.textContent = "Aplikasi sudah terpasang.";
      info.style.display = "";
    }
  });
}

function dismissBanner() {
  $("pwaBanner").classList.remove("show");
}

async function promptInstall() {
  dismissBanner();
  if (!deferredPWA) {
    toast("Instalasi tidak tersedia di perangkat ini", "error");
    return;
  }
  deferredPWA.prompt();
  await deferredPWA.userChoice;
  deferredPWA = null;
}

/* ─── EVENTS ─── */
function bindEvents() {
  $("toggleBtn").addEventListener("click", toggleService);
  $("logoutBtn").addEventListener("click", function () {
    window.location.href = "/logout";
  });

  $("addHariBtn").addEventListener("click", addHari);
  $("newHariInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") addHari();
  });
  $("deleteHariBtn").addEventListener("click", deleteHari);
  $("addEntryBtn").addEventListener("click", openAddEntry);

  $("saveEntryBtn").addEventListener("click", saveEntry);
  $("cancelModalBtn").addEventListener("click", closeModal);
  $("cancelModalBtn2").addEventListener("click", closeModal);
  $("entryModal").addEventListener("click", function (e) {
    if (e.target === $("entryModal")) closeModal();
  });

  $("overrideToggle").addEventListener("change", function () {
    configData.manual_override = $("overrideToggle").checked;
  });
  $("saveConfigBtn").addEventListener("click", saveConfig);

  $("addLiburBtn").addEventListener("click", addLibur);
  $("refreshLogBtn").addEventListener("click", loadLog);
  $("backupBtn").addEventListener("click", downloadBackup);
  $("changePassBtn").addEventListener("click", changePassword);

  $("installAppBtn").addEventListener("click", promptInstall);
  $("dismissBannerBtn").addEventListener("click", dismissBanner);
  $("installBannerBtn").addEventListener("click", promptInstall);

  $("restoreInput").addEventListener("change", function (e) {
    restoreBackup(e.target.files[0]);
  });
  $("fileInput").addEventListener("change", function (e) {
    uploadFile(e.target.files[0]);
  });

  var zone = $("uploadZone");
  zone.addEventListener("click", function () {
    $("fileInput").click();
  });
  zone.addEventListener("dragover", function (e) {
    e.preventDefault();
    zone.classList.add("over");
  });
  zone.addEventListener("dragleave", function () {
    zone.classList.remove("over");
  });
  zone.addEventListener("drop", function (e) {
    e.preventDefault();
    zone.classList.remove("over");
    var f = e.dataTransfer.files[0];
    if (f) uploadFile(f);
  });
}

/* ─── INIT ─── */
(async function () {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
  setupNav();
  bindEvents();
  setupOffline();
  setupPWA();
  await Promise.all([loadStatus(), loadJadwal(), loadTones(), loadConfig()]);
  setInterval(loadStatus, 10000);
  var splash = $("splash");
  if (splash) splash.classList.add("gone");
})();

```
---

## static/style.css
```css
:root {
  --c-bg: #fdf6ee;
  --c-bg2: #f5ead8;
  --c-surf: #ffffff;
  --c-surf2: #fffaf4;
  --c-border: #e8d0b8;
  --c-border2: #f0e3cc;
  --c-ink: #1a0a00;
  --c-ink2: #3b1a06;
  --c-ink3: #6b3a14;
  --c-ink4: #9a6840;
  --c-ink5: #c9a070;
  --c-brand: #b84800;
  --c-brand-d: #8e3600;
  --c-brand-l: #fff3e6;
  --c-brand-m: #ffd5a8;
  --c-amber: #7a4800;
  --c-amber-l: #fffbeb;
  --c-amber-m: #fff0b8;
  --c-amber-b: #fdd050;
  --c-green: #1a5c28;
  --c-green-l: #f0fdf4;
  --c-green-m: #d0f5de;
  --c-green-b: #6dd08c;
  --c-red: #820f00;
  --c-red-l: #fff1ee;
  --c-red-m: #ffd0c8;
  --c-red-b: #ffa090;
  --c-violet: #430d8c;
  --c-violet-l: #f3f0ff;
  --c-violet-m: #e0d5ff;
  --c-rose: #800826;
  --c-rose-l: #fff0f3;
  --c-rose-m: #ffd0dc;
  --topbar-h: 60px;
  --sidebar-w: 210px;
  --botnav-h: 60px;
  --radius: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --shadow: 0 1px 4px rgba(60, 20, 0, .07);
  --shadow-md: 0 4px 12px rgba(60, 20, 0, .1);
  --shadow-lg: 0 12px 32px rgba(60, 20, 0, .13);
  --shadow-xl: 0 24px 56px rgba(60, 20, 0, .18);
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
}

body {
  font-family: 'Lexend', system-ui, -apple-system, sans-serif;
  background: var(--c-bg);
  color: var(--c-ink);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}

::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--c-border);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--c-ink5);
}


/* === SPLASH === */
.splash {
  position: fixed;
  inset: 0;
  background: #1a0a00;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  transition: opacity .5s, visibility .5s;
}

.splash.gone {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.splash-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.splash-icon {
  width: 52px;
  height: 52px;
  border-radius: 15px;
  background: rgba(184, 72, 0, .18);
  border: 1px solid rgba(184, 72, 0, .28);
  display: flex;
  align-items: center;
  justify-content: center;
}

.splash-icon svg {
  width: 24px;
  height: 24px;
  stroke: #ffa050;
}

.splash-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, .4);
}

.splash-spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, .1);
  border-top-color: #ffa050;
  animation: spin .7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}


/* === OFFLINE BAR === */
.offline-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 600;
  background: var(--c-amber);
  color: #fff;
  text-align: center;
  font-size: 11.5px;
  font-weight: 600;
  padding: 6px 16px;
  letter-spacing: .01em;
  transform: translateY(-100%);
  transition: transform .3s;
}

.offline-bar.show {
  transform: none;
}


/* === TOPBAR === */
.topbar {
  position: sticky;
  top: 0;
  z-index: 300;
  height: var(--topbar-h);
  background: #1a0a00;
  border-bottom: 1px solid rgba(255, 255, 255, .06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  gap: 12px;
}

.topbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.topbar-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 10px;
  background: rgba(255, 160, 80, .1);
  border: 1px solid rgba(255, 160, 80, .16);
  display: flex;
  align-items: center;
  justify-content: center;
}

.topbar-icon svg {
  width: 16px;
  height: 16px;
  stroke: #ffa050;
}

.topbar-title {
  display: flex;
  flex-direction: column;
}

.topbar-name {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -.01em;
}

.topbar-sub {
  font-size: 10px;
  color: rgba(255, 255, 255, .3);
  font-weight: 400;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-cluster {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mode-chip {
  padding: 3px 9px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .05em;
  text-transform: uppercase;
  background: rgba(255, 160, 80, .1);
  color: #ffa050;
  border: 1px solid rgba(255, 160, 80, .2);
}

.mode-chip.ramadhan {
  background: rgba(253, 208, 80, .1);
  color: #fdd050;
  border-color: rgba(253, 208, 80, .2);
}

.mode-chip.pts {
  background: rgba(167, 140, 255, .1);
  color: #b0a0e8;
  border-color: rgba(167, 140, 255, .2);
}

.mode-chip.pas {
  background: rgba(255, 120, 90, .1);
  color: #ff7858;
  border-color: rgba(255, 120, 90, .2);
}

.libur-chip {
  display: none;
  padding: 3px 9px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .05em;
  text-transform: uppercase;
  background: rgba(255, 90, 60, .1);
  color: #ff6040;
  border: 1px solid rgba(255, 90, 60, .18);
}

.libur-chip.show {
  display: inline-flex;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px 4px 8px;
  background: rgba(255, 255, 255, .05);
  border: 1px solid rgba(255, 255, 255, .08);
  border-radius: 20px;
  font-size: 11px;
  color: rgba(255, 255, 255, .4);
  font-weight: 400;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #555;
  flex-shrink: 0;
  transition: background .3s, box-shadow .3s;
}

.status-dot.on {
  background: #50b868;
  box-shadow: 0 0 0 3px rgba(80, 184, 104, .22);
}

.top-btn {
  padding: 6px 13px;
  border-radius: var(--radius);
  border: 1px solid rgba(255, 255, 255, .1);
  background: rgba(255, 255, 255, .06);
  color: rgba(255, 255, 255, .6);
  font-size: 11.5px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all .15s;
  white-space: nowrap;
}

.top-btn:hover {
  background: rgba(255, 255, 255, .12);
  color: #fff;
}

.top-btn-accent {
  background: rgba(184, 72, 0, .28);
  border-color: rgba(184, 72, 0, .45);
  color: #ffa050;
}

.top-btn-accent:hover {
  background: rgba(184, 72, 0, .42);
  color: #ffc880;
}


/* === LAYOUT === */
.layout {
  display: flex;
  min-height: calc(100vh - var(--topbar-h));
}


/* === SIDEBAR === */
.sidebar {
  width: var(--sidebar-w);
  flex-shrink: 0;
  background: var(--c-surf);
  border-right: 1px solid var(--c-border);
  padding: 16px 10px;
  position: sticky;
  top: var(--topbar-h);
  height: calc(100vh - var(--topbar-h));
  overflow-y: auto;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidenav {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--c-ink3);
  border-radius: var(--radius);
  font-family: inherit;
  text-align: left;
  transition: color .15s, background .15s;
}

.sidenav svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  flex-shrink: 0;
}

.sidenav:hover:not(.active) {
  color: var(--c-ink2);
  background: var(--c-bg2);
}

.sidenav.active {
  color: var(--c-brand);
  background: var(--c-brand-l);
  font-weight: 600;
}


/* === BOTTOM NAV (mobile) === */
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
  background: var(--c-surf);
  border-top: 1px solid var(--c-border);
  height: var(--botnav-h);
  justify-content: space-around;
  align-items: center;
  padding: 0 2px;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.botnav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
  padding: 7px 2px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 9px;
  font-weight: 600;
  color: var(--c-ink4);
  font-family: inherit;
  transition: color .15s;
}

.botnav svg {
  width: 19px;
  height: 19px;
  stroke: currentColor;
}

.botnav.active {
  color: var(--c-brand);
}


/* === MAIN CONTENT === */
.main-content {
  flex: 1;
  min-width: 0;
  padding: 24px 26px 48px;
  max-width: 880px;
}

.page {
  display: none;
}

.page.active {
  display: block;
  animation: pageIn .2s ease both;
}

@keyframes pageIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

.page-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--c-ink);
  letter-spacing: -.02em;
  margin-bottom: 18px;
}


/* === CARDS === */
.card {
  background: var(--c-surf);
  border-radius: var(--radius-lg);
  border: 1px solid var(--c-border);
  box-shadow: var(--shadow);
  padding: 20px;
  margin-bottom: 14px;
}

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.card-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--c-ink);
  letter-spacing: -.01em;
}

.card-desc {
  font-size: 12px;
  color: var(--c-ink4);
  margin-top: 3px;
  font-weight: 400;
  line-height: 1.5;
}


/* === FORM ELEMENTS === */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--c-ink3);
  text-transform: uppercase;
  letter-spacing: .07em;
}

input[type=text],
input[type=password],
input[type=date],
input[type=time],
select {
  width: 100%;
  padding: 9px 12px;
  border: 1.5px solid var(--c-border);
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--c-ink);
  background: var(--c-surf);
  outline: none;
  font-family: inherit;
  transition: border-color .15s, box-shadow .15s;
  -webkit-appearance: none;
}

input::placeholder {
  color: var(--c-ink5);
}

input:focus,
select:focus {
  border-color: var(--c-brand);
  box-shadow: 0 0 0 3px rgba(184, 72, 0, .1);
}

.add-row {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.add-row .field-group {
  flex: 1;
  min-width: 140px;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}


/* === BUTTONS === */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
  font-family: inherit;
  transition: all .15s;
  white-space: nowrap;
  line-height: 1.2;
}

.btn:active {
  transform: scale(.97);
}

.btn-primary {
  background: var(--c-brand);
  color: #fff;
  border-color: var(--c-brand);
  box-shadow: 0 2px 8px rgba(184, 72, 0, .3);
}

.btn-primary:hover {
  background: var(--c-brand-d);
}

.btn-ghost {
  background: var(--c-surf);
  color: var(--c-ink2);
  border-color: var(--c-border);
}

.btn-ghost:hover {
  background: var(--c-bg2);
  border-color: var(--c-ink5);
}

.btn-danger {
  background: var(--c-red-l);
  color: var(--c-red);
  border-color: var(--c-red-b);
}

.btn-danger:hover {
  background: var(--c-red-m);
}

.btn-success {
  background: var(--c-green-l);
  color: var(--c-green);
  border-color: var(--c-green-b);
}

.btn-success:hover {
  background: var(--c-green-m);
}

.btn-warn {
  background: var(--c-amber-l);
  color: var(--c-amber);
  border-color: var(--c-amber-b);
}

.btn-warn:hover {
  background: var(--c-amber-m);
}

.btn-sm {
  padding: 5px 11px;
  font-size: 11.5px;
}

.btn-group {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}


/* === TAB STRIPS === */
.tab-strip {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.mode-tab {
  padding: 6px 14px;
  border-radius: var(--radius);
  border: 1.5px solid var(--c-border);
  background: var(--c-bg);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--c-ink3);
  font-family: inherit;
  transition: all .15s;
}

.mode-tab:hover:not(.active) {
  border-color: var(--c-ink5);
  color: var(--c-ink2);
  background: var(--c-bg2);
}

.mode-tab.active[data-mode=reguler] {
  background: var(--c-brand);
  color: #fff;
  border-color: var(--c-brand);
}

.mode-tab.active[data-mode=ramadhan] {
  background: #b87000;
  color: #fff;
  border-color: #b87000;
}

.mode-tab.active[data-mode=pts] {
  background: var(--c-violet);
  color: #fff;
  border-color: var(--c-violet);
}

.mode-tab.active[data-mode=pas] {
  background: var(--c-rose);
  color: #fff;
  border-color: var(--c-rose);
}

.hari-strip {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--c-border2);
}

.hari-tab {
  padding: 5px 13px;
  border-radius: var(--radius);
  border: 1.5px solid var(--c-border);
  background: var(--c-surf);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--c-ink2);
  font-family: inherit;
  transition: all .15s;
}

.hari-tab:hover:not(.active) {
  border-color: var(--c-brand-m);
  color: var(--c-brand);
  background: var(--c-brand-l);
}

.hari-tab.active {
  background: var(--c-brand);
  color: #fff;
  border-color: var(--c-brand);
}


/* === MODE CARDS === */
.mode-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 18px;
}

.mode-card {
  border: 1.5px solid var(--c-border);
  border-radius: var(--radius-md);
  padding: 16px 12px;
  cursor: pointer;
  text-align: center;
  transition: all .18s;
  background: var(--c-bg);
}

.mode-card:hover {
  border-color: var(--c-brand-m);
  background: var(--c-brand-l);
}

.mode-card.active[data-mode=reguler] {
  border-color: var(--c-brand);
  background: var(--c-brand-l);
  box-shadow: 0 0 0 3px rgba(184, 72, 0, .1);
}

.mode-card.active[data-mode=ramadhan] {
  border-color: #b87000;
  background: var(--c-amber-l);
  box-shadow: 0 0 0 3px rgba(184, 112, 0, .1);
}

.mode-card.active[data-mode=pts] {
  border-color: var(--c-violet);
  background: var(--c-violet-l);
  box-shadow: 0 0 0 3px rgba(67, 13, 140, .1);
}

.mode-card.active[data-mode=pas] {
  border-color: var(--c-rose);
  background: var(--c-rose-l);
  box-shadow: 0 0 0 3px rgba(128, 8, 38, .1);
}

.mode-card-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-border);
  margin: 0 auto 10px;
  transition: background .18s;
}

.mode-card.active[data-mode=reguler] .mode-card-dot {
  background: var(--c-brand);
}

.mode-card.active[data-mode=ramadhan] .mode-card-dot {
  background: #b87000;
}

.mode-card.active[data-mode=pts] .mode-card-dot {
  background: var(--c-violet);
}

.mode-card.active[data-mode=pas] .mode-card-dot {
  background: var(--c-rose);
}

.mode-card-name {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--c-ink);
  letter-spacing: -.01em;
}

.mode-card-hint {
  font-size: 10.5px;
  color: var(--c-ink4);
  margin-top: 3px;
  line-height: 1.4;
  font-weight: 400;
}


/* === TOGGLE === */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid var(--c-border2);
  gap: 16px;
  margin-top: 4px;
}

.toggle-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-ink);
}

.toggle-hint {
  font-size: 11.5px;
  color: var(--c-ink4);
  margin-top: 2px;
  font-weight: 400;
}

.switch {
  position: relative;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-track {
  position: absolute;
  inset: 0;
  background: var(--c-ink5);
  border-radius: 22px;
  cursor: pointer;
  transition: background .25s;
}

.switch-track::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 3px;
  top: 3px;
  background: #fff;
  border-radius: 50%;
  transition: transform .25s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .2);
}

input:checked+.switch-track {
  background: var(--c-brand);
}

input:checked+.switch-track::before {
  transform: translateX(18px);
}


/* === TABLE === */
.table-wrap {
  overflow-x: auto;
  border-radius: var(--radius);
  border: 1px solid var(--c-border2);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th {
  text-align: left;
  padding: 9px 13px;
  background: var(--c-bg2);
  color: var(--c-ink3);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  border-bottom: 1px solid var(--c-border);
}

td {
  padding: 11px 13px;
  border-bottom: 1px solid var(--c-border2);
  vertical-align: middle;
  color: var(--c-ink2);
}

tr:last-child td {
  border-bottom: none;
}

tbody tr {
  transition: background .1s;
}

tbody tr:hover td {
  background: var(--c-bg);
}

.td-num {
  color: var(--c-ink5);
  font-size: 11px;
  width: 32px;
}

.td-time {
  font-weight: 700;
  color: var(--c-ink);
  font-variant-numeric: tabular-nums;
}

.td-audio {
  color: var(--c-ink3);
  font-size: 12px;
}


/* === NOTICE === */
.notice {
  border-radius: var(--radius);
  padding: 11px 14px;
  font-size: 12.5px;
  border: 1px solid;
  margin-bottom: 16px;
  line-height: 1.5;
  font-weight: 400;
}

.notice-warn {
  background: var(--c-amber-l);
  border-color: var(--c-amber-b);
  color: var(--c-amber);
}

.notice-info {
  background: var(--c-brand-l);
  border-color: var(--c-brand-m);
  color: var(--c-brand-d);
}


/* === LIBUR LIST === */
.libur-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 13px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  margin-bottom: 7px;
  gap: 10px;
  flex-wrap: wrap;
  transition: border-color .15s;
}

.libur-item:last-child {
  margin-bottom: 0;
}

.libur-item.today {
  border-color: var(--c-amber-b);
  background: var(--c-amber-l);
}

.libur-date {
  font-size: 13px;
  font-weight: 600;
  color: var(--c-ink);
}

.today-tag {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 1px 7px;
  background: var(--c-amber-m);
  color: var(--c-amber);
  border-radius: 4px;
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
}


/* === TONE LIST === */
.tone-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 13px;
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  margin-bottom: 6px;
  gap: 10px;
  flex-wrap: wrap;
  transition: border-color .15s;
}

.tone-item:hover {
  border-color: var(--c-ink5);
}

.tone-item:last-child {
  margin-bottom: 0;
}

.tone-name {
  font-size: 12.5px;
  color: var(--c-ink2);
  word-break: break-all;
  font-weight: 500;
}


/* === UPLOAD ZONE === */
.upload-zone {
  border: 1.5px dashed var(--c-border);
  border-radius: var(--radius-lg);
  padding: 36px 24px;
  text-align: center;
  cursor: pointer;
  background: var(--c-bg);
  transition: all .2s;
}

.upload-zone:hover,
.upload-zone.over {
  border-color: var(--c-brand);
  background: var(--c-brand-l);
}

.upload-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--c-bg2);
  border: 1px solid var(--c-border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
  transition: all .2s;
}

.upload-icon svg {
  width: 20px;
  height: 20px;
  stroke: var(--c-ink4);
  transition: stroke .2s;
}

.upload-zone:hover .upload-icon,
.upload-zone.over .upload-icon {
  background: var(--c-brand-m);
  border-color: var(--c-brand);
}

.upload-zone:hover .upload-icon svg,
.upload-zone.over .upload-icon svg {
  stroke: var(--c-brand);
}

.upload-zone p {
  color: var(--c-ink2);
  font-size: 13px;
  font-weight: 500;
}

.upload-zone small {
  font-size: 11.5px;
  color: var(--c-ink4);
  display: block;
  margin-top: 4px;
}

#fileInput {
  display: none;
}


/* === LOG BADGES === */
.log-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
}

.log-badge.reguler {
  background: var(--c-brand-l);
  color: var(--c-brand-d);
}

.log-badge.ramadhan {
  background: var(--c-amber-l);
  color: var(--c-amber);
}

.log-badge.pts {
  background: var(--c-violet-l);
  color: var(--c-violet);
}

.log-badge.pas {
  background: var(--c-rose-l);
  color: var(--c-rose);
}


/* === COUNT BADGE === */
.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  background: var(--c-bg);
  color: var(--c-ink3);
  border-radius: 11px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid var(--c-border);
}


/* === EMPTY STATE === */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--c-ink4);
  font-size: 13px;
  font-weight: 400;
}


/* === MODAL === */
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(26, 10, 0, .6);
  z-index: 500;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  padding: 20px;
}

.modal-overlay.open {
  display: flex;
  animation: fadeIn .18s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.modal {
  background: var(--c-surf);
  border-radius: var(--radius-xl);
  width: min(440px, 100%);
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--c-border);
  animation: modalIn .2s cubic-bezier(.34, 1.56, .64, 1);
  overflow: hidden;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(.95) translateY(10px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--c-border2);
  gap: 12px;
}

.modal-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--c-ink);
  letter-spacing: -.01em;
}

.modal-sub {
  font-size: 12px;
  color: var(--c-ink4);
  margin-top: 3px;
}

.modal-close {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  flex-shrink: 0;
  border: 1px solid var(--c-border);
  background: var(--c-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all .15s;
  padding: 0;
}

.modal-close svg {
  width: 14px;
  height: 14px;
  stroke: var(--c-ink3);
}

.modal-close:hover {
  background: var(--c-bg2);
  border-color: var(--c-ink5);
}

.modal-body {
  padding: 20px 22px;
}

.modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 14px 22px 20px;
  border-top: 1px solid var(--c-border2);
}


/* === TOAST === */
.toast {
  position: fixed;
  bottom: 22px;
  right: 22px;
  left: 22px;
  max-width: 340px;
  margin: 0 auto;
  background: var(--c-ink);
  color: #fff;
  padding: 12px 18px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  z-index: 700;
  pointer-events: none;
  opacity: 0;
  transform: translateY(10px);
  transition: all .25s;
  box-shadow: var(--shadow-xl);
  line-height: 1.4;
}

.toast.show {
  opacity: 1;
  transform: none;
}

.toast.error {
  background: #6e1000;
}

.toast.ok {
  background: #1a5228;
}


/* === PWA BANNER === */
.pwa-banner {
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translate(-50%, 160%);
  width: min(420px, calc(100% - 32px));
  background: var(--c-surf);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 400;
  transition: transform .4s cubic-bezier(.34, 1.56, .64, 1);
}

.pwa-banner.show {
  transform: translate(-50%, 0);
}

.pwa-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 11px;
  background: var(--c-brand-l);
  border: 1px solid var(--c-brand-m);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pwa-icon svg {
  width: 18px;
  height: 18px;
  stroke: var(--c-brand);
}

.pwa-text {
  flex: 1;
  min-width: 0;
}

.pwa-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--c-ink);
}

.pwa-desc {
  font-size: 11.5px;
  color: var(--c-ink4);
  margin-top: 2px;
}

.pwa-btns {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}


/* === RESPONSIVE === */
@media (max-width: 780px) {
  .sidebar {
    display: none;
  }

  .bottom-nav {
    display: flex;
  }

  .layout {
    flex-direction: column;
  }

  .main-content {
    padding: 18px 16px calc(var(--botnav-h) + 20px);
    max-width: 100%;
  }

  .mode-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 600px) {
  .topbar {
    flex-wrap: wrap;
    height: auto;
    padding: 10px 16px;
    gap: 8px;
  }

  .topbar-right {
    width: 100%;
    justify-content: space-between;
  }

  .topbar-sub {
    display: none;
  }

  .status-cluster .mode-chip {
    display: none;
  }

  .toast {
    bottom: calc(var(--botnav-h) + 10px);
    right: 14px;
    left: 14px;
  }

  .pwa-banner {
    bottom: calc(var(--botnav-h) + 10px);
  }
}

@media (max-width: 480px) {
  .add-row {
    flex-direction: column;
    align-items: stretch;
  }

  .add-row .btn {
    justify-content: center;
  }

  .two-col {
    grid-template-columns: 1fr;
  }

  .modal-body {
    padding: 16px 18px;
  }

  .modal-header,
  .modal-footer {
    padding-left: 18px;
    padding-right: 18px;
  }
}

@media (min-width: 480px) {
  .toast {
    left: auto;
  }
}

@media (min-width: 1200px) {
  .main-content {
    padding: 28px 36px 56px;
  }
}

```
---

## static/sw.js
```text
const CACHE_VERSION = "bel-madrasah-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const PRECACHE_URLS = [
  "/static/style.css",
  "/static/script.js",
  "/static/manifest.json",
  "/static/offline.html",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("bel-madrasah-") && key !== STATIC_CACHE && key !== RUNTIME_CACHE
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/logout")
  );
}

function isStaticAsset(url) {
  return url.pathname.startsWith("/static/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            JSON.stringify({ error: "Anda sedang offline. Periksa koneksi jaringan." }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          )
      )
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() =>
        caches
          .open(RUNTIME_CACHE)
          .then((cache) =>
            cache.match(request).then((cached) => cached || caches.match("/static/offline.html"))
          )
      )
  );
});

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
	Mode           string   `json:"mode"`
	ManualOverride bool     `json:"manual_override"`
	RamadhanStart  string   `json:"ramadhan_start"`
	RamadhanEnd    string   `json:"ramadhan_end"`
	PTSStart       string   `json:"pts_start"`
	PTSEnd         string   `json:"pts_end"`
	PASStart       string   `json:"pas_start"`
	PASEnd         string   `json:"pas_end"`
	LiburDates     []string `json:"libur_dates"`
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

func defaultConfig() Config {
	return Config{
		Mode:          "reguler",
		RamadhanStart: "",
		RamadhanEnd:   "",
		LiburDates:    []string{},
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
		c.LiburDates = []string{}
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
	return os.WriteFile(configFile, data, 0644)
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
	if c.RamadhanStart != "" && c.RamadhanEnd != "" && today >= c.RamadhanStart && today <= c.RamadhanEnd {
		return "ramadhan"
	}
	return "reguler"
}

func isLibur(c Config) bool {
	today := time.Now().Format("2006-01-02")
	for _, d := range c.LiburDates {
		if d == today {
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
	for _, m := range []string{"reguler", "ramadhan", "pts", "pas"} {
		if j[m] == nil {
			j[m] = map[string][]Entry{}
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
	for _, m := range []string{"reguler", "ramadhan", "pts", "pas"} {
		if j[m] == nil {
			j[m] = dj[m]
			changed = true
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
	return ModeJadwal{
		"reguler": {
			"Senin": {
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
			},
			"Selasa": {
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
			},
			"Rabu": {
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
			},
			"Kamis": {
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
			},
			"Jumat": {
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
			},
		},
		"ramadhan": {
			"Senin": {
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
			},
			"Selasa": {
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
			},
			"Rabu": {
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
			},
			"Kamis": {
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
			},
			"Jumat": {
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:00", Audio: b + "/rohani.mp3"},
				{Waktu: "07:40", Audio: b + "/pelajaran-3.mp3"},
				{Waktu: "08:20", Audio: b + "/pelajaran-4.mp3"},
				{Waktu: "09:00", Audio: b + "/istirahat-1.mp3"},
				{Waktu: "09:10", Audio: b + "/pelajaran-5.mp3"},
				{Waktu: "09:50", Audio: b + "/pelajaran-6.mp3"},
				{Waktu: "10:20", Audio: b + "/akhir-pekan.mp3"},
				{Waktu: "10:21", Audio: b + "/tanah-airku.mp3"},
			},
		},
		"pts": {
			"Senin":  {{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"}, {Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"}, {Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"}, {Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"}, {Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"}, {Waktu: "10:31", Audio: b + "/tanah-airku.mp3"}},
			"Selasa": {{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"}, {Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"}, {Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"}, {Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"}, {Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"}, {Waktu: "10:31", Audio: b + "/tanah-airku.mp3"}},
			"Rabu":   {{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"}, {Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"}, {Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"}, {Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"}, {Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"}, {Waktu: "10:31", Audio: b + "/tanah-airku.mp3"}},
			"Kamis":  {{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"}, {Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"}, {Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"}, {Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"}, {Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"}, {Waktu: "10:31", Audio: b + "/tanah-airku.mp3"}},
			"Jumat":  {{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"}, {Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"}, {Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"}, {Waktu: "09:30", Audio: b + "/pelajaran-selesai.mp3"}, {Waktu: "09:31", Audio: b + "/tanah-airku.mp3"}},
		},
		"pas": {
			"Senin":  {{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"}, {Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"}, {Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"}, {Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"}, {Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"}, {Waktu: "10:31", Audio: b + "/tanah-airku.mp3"}},
			"Selasa": {{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"}, {Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"}, {Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"}, {Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"}, {Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"}, {Waktu: "10:31", Audio: b + "/tanah-airku.mp3"}},
			"Rabu":   {{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"}, {Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"}, {Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"}, {Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"}, {Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"}, {Waktu: "10:31", Audio: b + "/tanah-airku.mp3"}},
			"Kamis":  {{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"}, {Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"}, {Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"}, {Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"}, {Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"}, {Waktu: "10:31", Audio: b + "/tanah-airku.mp3"}},
			"Jumat":  {{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"}, {Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"}, {Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"}, {Waktu: "09:30", Audio: b + "/pelajaran-selesai.mp3"}, {Waktu: "09:31", Audio: b + "/tanah-airku.mp3"}},
		},
	}
}

```
---

## uninstall.sh
```bash
#!/bin/bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/opt/bel-madrasah"
SERVICE_NAME="bel-madrasah"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
NGINX_CONF="/etc/nginx/sites-available/bel-madrasah"
NGINX_ENABLED="/etc/nginx/sites-enabled/bel-madrasah"

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
cmd_exists() { command -v "$1" >/dev/null 2>&1; }

[ "$EUID" -eq 0 ] || error "Jalankan sebagai root: sudo $0"

echo "========================================="
echo " Bel Madrasah - Uninstaller"
echo " ZEDLABS Teknologi Indonesia"
echo "========================================="
echo

read -rp "Lanjutkan penghapusan? [y/N]: " -n 1; echo
[[ $REPLY =~ ^[Yy]$ ]] || { info "Penghapusan dibatalkan."; exit 0; }

if systemctl list-unit-files 2>/dev/null | grep -q "^${SERVICE_NAME}.service"; then
    systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null && {
        systemctl stop "${SERVICE_NAME}"
        success "Service dihentikan."
    }
    systemctl is-enabled --quiet "${SERVICE_NAME}" 2>/dev/null && {
        systemctl disable "${SERVICE_NAME}"
        success "Service dinonaktifkan dari autostart."
    }
else
    warning "Service ${SERVICE_NAME} tidak terdaftar di systemd."
fi

if [ -f "$SERVICE_FILE" ]; then
    rm -f "$SERVICE_FILE"
    systemctl daemon-reload
    success "Unit file systemd dihapus."
fi

[ -L "$NGINX_ENABLED" ] || [ -f "$NGINX_ENABLED" ] && {
    rm -f "$NGINX_ENABLED"
    success "Site nginx dinonaktifkan."
}

if [ -f "$NGINX_CONF" ]; then
    read -rp "Hapus konfigurasi nginx? [y/N]: " -n 1; echo
    [[ $REPLY =~ ^[Yy]$ ]] && { rm -f "$NGINX_CONF"; success "Konfigurasi nginx dihapus."; }
fi

if cmd_exists nginx && nginx -t 2>/dev/null; then
    systemctl reload nginx 2>/dev/null || true
    success "nginx direload."
fi

if [ ! -d "$PROJECT_DIR" ]; then
    success "Direktori ${PROJECT_DIR} sudah tidak ada."
    echo; success "PENGHAPUSAN SELESAI"; exit 0
fi

echo
warning "Direktori: ${PROJECT_DIR}"
warning "Berisi binary, jadwal, log, audio, dan data login."
echo
read -rp "Hapus SELURUH direktori termasuk data? [y/N]: " -n 1; echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$PROJECT_DIR"
    success "Direktori ${PROJECT_DIR} dihapus sepenuhnya."
else
    read -rp "Hapus hanya binary dan static (data & audio tetap)? [y/N]: " -n 1; echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f "${PROJECT_DIR}/bel-madrasah"
        rm -rf "${PROJECT_DIR}/static"
        success "Binary dan file static dihapus."
        info "Data tersimpan di:"
        info "  ${PROJECT_DIR}/data"
        info "  ${PROJECT_DIR}/tone"
    else
        info "Tidak ada file yang dihapus."
    fi
fi

echo
echo "========================================="
success "PENGHAPUSAN SELESAI"
echo "========================================="

```
---
