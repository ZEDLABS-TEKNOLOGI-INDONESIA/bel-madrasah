# SOURCE CODE

## auth.go
```go
package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"
)

const (
	usersFile      = dataDir + "/users.json"
	sessionTimeout = 8 * time.Hour
	cookieName     = "bel_session"
)

type User struct {
	Username     string `json:"username"`
	PasswordHash string `json:"password_hash"`
}

type Session struct {
	Username  string
	ExpiresAt time.Time
}

var (
	sessions   = make(map[string]*Session)
	sessionsMu sync.RWMutex
)

func hashPassword(password string) string {
	h := sha256.Sum256([]byte(password))
	return hex.EncodeToString(h[:])
}

func initAuth() error {
	if _, err := os.Stat(usersFile); os.IsNotExist(err) {
		defaultUser := User{
			Username:     "admin",
			PasswordHash: hashPassword("admin123"),
		}
		data, err := json.MarshalIndent(defaultUser, "", "  ")
		if err != nil {
			return err
		}
		if err := os.WriteFile(usersFile, data, 0600); err != nil {
			return err
		}
		logMsg("Akun admin default dibuat. Username: admin | Password: admin123")
		logMsg("PENTING: Segera ganti password melalui halaman pengaturan.")
	}
	return nil
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
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return nil
	}
	sessionsMu.RLock()
	sess, ok := sessions[cookie.Value]
	sessionsMu.RUnlock()
	if !ok || time.Now().After(sess.ExpiresAt) {
		return nil
	}
	return sess
}

func requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if getSession(r) == nil {
			if r.Header.Get("Accept") == "application/json" ||
				r.Header.Get("Content-Type") == "application/json" {
				jsonError(w, "Unauthorized", http.StatusUnauthorized)
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

go 1.24.4

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

func registerRoutes(mux *http.ServeMux) {
	registerPWARoutes(mux)
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

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

func handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		if getSession(r) != nil {
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}
		http.ServeFile(w, r, filepath.Join(staticDir, "login.html"))
		return
	}
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "Request tidak valid", http.StatusBadRequest)
		return
	}
	user, err := loadUser()
	if err != nil {
		jsonError(w, "Gagal memuat data user", http.StatusInternalServerError)
		return
	}
	if body.Username != user.Username || hashPassword(body.Password) != user.PasswordHash {
		jsonError(w, "Username atau password salah", http.StatusUnauthorized)
		return
	}
	token, err := createSession(body.Username)
	if err != nil {
		jsonError(w, "Gagal membuat sesi", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(sessionTimeout),
	})
	jsonOK(w, map[string]string{"message": "Login berhasil"})
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(cookieName)
	if err == nil {
		sessionsMu.Lock()
		delete(sessions, cookie.Value)
		sessionsMu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{
		Name:    cookieName,
		Value:   "",
		Path:    "/",
		Expires: time.Unix(0, 0),
	})
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

func handleChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	var body struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "Request tidak valid", http.StatusBadRequest)
		return
	}
	user, err := loadUser()
	if err != nil {
		jsonError(w, "Gagal memuat data user", http.StatusInternalServerError)
		return
	}
	if hashPassword(body.OldPassword) != user.PasswordHash {
		jsonError(w, "Password lama salah", http.StatusUnauthorized)
		return
	}
	if len(body.NewPassword) < 6 {
		jsonError(w, "Password baru minimal 6 karakter", http.StatusBadRequest)
		return
	}
	user.PasswordHash = hashPassword(body.NewPassword)
	if err := saveUser(user); err != nil {
		jsonError(w, "Gagal menyimpan password", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"message": "Password berhasil diubah"})
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
			jsonError(w, "Gagal memuat config", http.StatusInternalServerError)
			return
		}
		active := resolveMode(cfg)
		jsonOK(w, map[string]any{
			"config":      cfg,
			"active_mode": active,
			"is_libur":    isLibur(cfg),
		})

	case http.MethodPost:
		var body Config
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonError(w, "Request tidak valid", http.StatusBadRequest)
			return
		}
		validModes := map[string]bool{"reguler": true, "ramadhan": true, "pts": true, "pas": true}
		if !validModes[body.Mode] {
			jsonError(w, "Mode tidak valid", http.StatusBadRequest)
			return
		}
		existing, _ := loadConfig()
		body.LiburDates = existing.LiburDates
		if err := saveConfig(body); err != nil {
			jsonError(w, "Gagal menyimpan config", http.StatusInternalServerError)
			return
		}
		logMsg(fmt.Sprintf("Config diperbarui: mode=%s override=%v", body.Mode, body.ManualOverride))
		jsonOK(w, map[string]string{"message": "Config berhasil disimpan"})

	default:
		http.NotFound(w, r)
	}
}

func handleLibur(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		cfg, err := loadConfig()
		if err != nil {
			jsonError(w, "Gagal memuat config", http.StatusInternalServerError)
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
			jsonError(w, "Request tidak valid", http.StatusBadRequest)
			return
		}
		if _, err := time.Parse("2006-01-02", body.Date); err != nil {
			jsonError(w, "Format tanggal tidak valid (YYYY-MM-DD)", http.StatusBadRequest)
			return
		}
		cfg, err := loadConfig()
		if err != nil {
			jsonError(w, "Gagal memuat config", http.StatusInternalServerError)
			return
		}
		switch body.Action {
		case "add":
			for _, d := range cfg.LiburDates {
				if d == body.Date {
					jsonError(w, "Tanggal sudah ada", http.StatusBadRequest)
					return
				}
			}
			cfg.LiburDates = append(cfg.LiburDates, body.Date)
		case "delete":
			newDates := cfg.LiburDates[:0]
			for _, d := range cfg.LiburDates {
				if d != body.Date {
					newDates = append(newDates, d)
				}
			}
			cfg.LiburDates = newDates
		default:
			jsonError(w, "Action tidak valid", http.StatusBadRequest)
			return
		}
		if err := saveConfig(cfg); err != nil {
			jsonError(w, "Gagal menyimpan config", http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]string{"message": "Berhasil"})

	default:
		http.NotFound(w, r)
	}
}

func handleJadwal(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	mode := r.URL.Query().Get("mode")
	if mode == "" {
		mode = "reguler"
	}
	j, err := loadJadwal()
	if err != nil {
		jsonError(w, "Gagal memuat jadwal", http.StatusInternalServerError)
		return
	}
	mj, ok := j[mode]
	if !ok {
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
		http.NotFound(w, r)
		return
	}
	var body struct {
		Action string `json:"action"`
		Mode   string `json:"mode"`
		Hari   string `json:"hari"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "Request tidak valid", http.StatusBadRequest)
		return
	}
	validModes := map[string]bool{"reguler": true, "ramadhan": true, "pts": true, "pas": true}
	if !validModes[body.Mode] {
		jsonError(w, "Mode tidak valid", http.StatusBadRequest)
		return
	}
	body.Hari = strings.TrimSpace(body.Hari)
	if body.Hari == "" {
		jsonError(w, "Nama hari tidak boleh kosong", http.StatusBadRequest)
		return
	}
	j, err := loadJadwal()
	if err != nil {
		jsonError(w, "Gagal memuat jadwal", http.StatusInternalServerError)
		return
	}
	if j[body.Mode] == nil {
		j[body.Mode] = map[string][]Entry{}
	}
	switch body.Action {
	case "add":
		if _, exists := j[body.Mode][body.Hari]; exists {
			jsonError(w, fmt.Sprintf("Hari %s sudah ada", body.Hari), http.StatusBadRequest)
			return
		}
		j[body.Mode][body.Hari] = []Entry{}
	case "delete":
		delete(j[body.Mode], body.Hari)
	default:
		jsonError(w, "Action tidak valid", http.StatusBadRequest)
		return
	}
	if err := saveJadwal(j); err != nil {
		jsonError(w, "Gagal menyimpan jadwal", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"message": "Berhasil"})
}

func handleJadwalEntry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
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
		jsonError(w, "Request tidak valid", http.StatusBadRequest)
		return
	}
	validModes := map[string]bool{"reguler": true, "ramadhan": true, "pts": true, "pas": true}
	if !validModes[body.Mode] {
		jsonError(w, "Mode tidak valid", http.StatusBadRequest)
		return
	}
	j, err := loadJadwal()
	if err != nil {
		jsonError(w, "Gagal memuat jadwal", http.StatusInternalServerError)
		return
	}
	if j[body.Mode] == nil {
		jsonError(w, "Mode tidak ditemukan", http.StatusNotFound)
		return
	}
	entries, ok := j[body.Mode][body.Hari]
	if !ok {
		jsonError(w, fmt.Sprintf("Hari %s tidak ditemukan", body.Hari), http.StatusNotFound)
		return
	}
	switch body.Action {
	case "add":
		entries = append(entries, body.Entry)
		sort.Slice(entries, func(i, k int) bool { return entries[i].Waktu < entries[k].Waktu })
	case "edit":
		if body.Index < 0 || body.Index >= len(entries) {
			jsonError(w, "Index tidak valid", http.StatusBadRequest)
			return
		}
		entries[body.Index] = body.Entry
		sort.Slice(entries, func(i, k int) bool { return entries[i].Waktu < entries[k].Waktu })
	case "delete":
		if body.Index < 0 || body.Index >= len(entries) {
			jsonError(w, "Index tidak valid", http.StatusBadRequest)
			return
		}
		entries = append(entries[:body.Index], entries[body.Index+1:]...)
	default:
		jsonError(w, "Action tidak valid", http.StatusBadRequest)
		return
	}
	j[body.Mode][body.Hari] = entries
	if err := saveJadwal(j); err != nil {
		jsonError(w, "Gagal menyimpan jadwal", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"message": "Berhasil"})
}

func handleTones(w http.ResponseWriter, r *http.Request) {
	files, err := listTones()
	if err != nil {
		jsonError(w, "Gagal membaca direktori tone", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"tones": files})
}

func handleTonesUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		jsonError(w, "File terlalu besar (maks 32MB)", http.StatusBadRequest)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "Gagal membaca file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".mp3" && ext != ".wav" && ext != ".ogg" {
		jsonError(w, "Format tidak didukung. Gunakan mp3, wav, atau ogg.", http.StatusBadRequest)
		return
	}
	filename := filepath.Base(header.Filename)
	dst, err := os.Create(filepath.Join(toneDir, filename))
	if err != nil {
		jsonError(w, "Gagal menyimpan file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, file); err != nil {
		jsonError(w, "Gagal menulis file", http.StatusInternalServerError)
		return
	}
	logMsg(fmt.Sprintf("File audio diupload: %s", filename))
	jsonOK(w, map[string]string{"message": "Upload berhasil", "filename": filename})
}

func handleTonesDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	var body struct {
		Filename string `json:"filename"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "Request tidak valid", http.StatusBadRequest)
		return
	}
	filename := filepath.Base(body.Filename)
	fullPath := filepath.Join(toneDir, filename)
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		jsonError(w, "File tidak ditemukan", http.StatusNotFound)
		return
	}
	if err := os.Remove(fullPath); err != nil {
		jsonError(w, "Gagal menghapus file", http.StatusInternalServerError)
		return
	}
	logMsg(fmt.Sprintf("File audio dihapus: %s", filename))
	jsonOK(w, map[string]string{"message": "File berhasil dihapus"})
}

func handleTonesPreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	var body struct {
		Filename string `json:"filename"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "Request tidak valid", http.StatusBadRequest)
		return
	}
	filename := filepath.Base(body.Filename)
	fullPath := filepath.Join(toneDir, filename)
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		jsonError(w, "File tidak ditemukan", http.StatusNotFound)
		return
	}
	go playSound(fullPath)
	logMsg(fmt.Sprintf("Preview tone: %s", filename))
	jsonOK(w, map[string]string{"message": fmt.Sprintf("Memutar %s", filename)})
}

func handleLog(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	logs, err := readLog()
	if err != nil {
		jsonError(w, "Gagal membaca log", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"logs": logs})
}

func handleBackup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.NotFound(w, r)
		return
	}
	data, err := os.ReadFile(jadwalFile)
	if err != nil {
		jsonError(w, "Gagal membaca jadwal", http.StatusInternalServerError)
		return
	}
	fname := "backup-jadwal-" + time.Now().Format("20060102-150405") + ".json"
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename="+fname)
	w.Write(data)
}

func handleRestore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	if err := r.ParseMultipartForm(4 << 20); err != nil {
		jsonError(w, "File terlalu besar", http.StatusBadRequest)
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "Gagal membaca file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		jsonError(w, "Gagal membaca isi file", http.StatusInternalServerError)
		return
	}
	var j ModeJadwal
	if err := json.Unmarshal(data, &j); err != nil {
		jsonError(w, "File tidak valid (bukan JSON jadwal yang benar)", http.StatusBadRequest)
		return
	}
	if err := saveJadwal(j); err != nil {
		jsonError(w, "Gagal menyimpan jadwal", http.StatusInternalServerError)
		return
	}
	logMsg("Jadwal berhasil direstore dari backup.")
	jsonOK(w, map[string]string{"message": "Jadwal berhasil direstore"})
}

func handleServiceStatus(w http.ResponseWriter, r *http.Request) {
	schedulerMu.Lock()
	running := schedulerRunning
	schedulerMu.Unlock()

	cfg, _ := loadConfig()
	active := resolveMode(cfg)
	libur := isLibur(cfg)

	jsonOK(w, map[string]any{
		"running":     running,
		"active_mode": active,
		"is_libur":    libur,
	})
}

func handleServiceToggle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
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
	logMsg(fmt.Sprintf("Scheduler %s via web.", state))
	jsonOK(w, map[string]any{"running": running, "message": fmt.Sprintf("Scheduler %s", state)})
}

```
---

## install.sh
```bash
#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/opt/bel-madrasah"
SERVICE_NAME="bel-madrasah"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
RUN_USER=$(logname 2>/dev/null || echo "${SUDO_USER:-$(whoami)}")

REQUIRED_ICON_SIZES=(72 96 128 144 152 192 384 512)
REQUIRED_MASKABLE_SIZES=(192 512)

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }

cmd_exists() {
    command -v "$1" >/dev/null 2>&1
}

check_requirements() {
    info "Memeriksa persyaratan sistem..."

    if [ "$EUID" -ne 0 ]; then
        error "Installer ini harus dijalankan sebagai root."
        error "Gunakan: sudo ./install.sh"
        exit 1
    fi

    if ! cmd_exists go; then
        error "Go tidak ditemukan. Install dari https://go.dev/dl/"
        exit 1
    fi
    success "Go: $(go version)"

    if ! cmd_exists systemctl; then
        error "systemctl tidak ditemukan. Sistem memerlukan systemd."
        exit 1
    fi
    success "systemctl ditemukan."

    success "Persyaratan sistem terpenuhi."
}

install_package() {
    local pkg="$1"
    info "Menginstall $pkg..."
    if cmd_exists apt; then
        apt update -qq && apt install -y "$pkg"
    elif cmd_exists dnf; then
        dnf install -y "$pkg"
    elif cmd_exists yum; then
        yum install -y "$pkg"
    elif cmd_exists pacman; then
        pacman -S --noconfirm "$pkg"
    else
        error "Package manager tidak dikenali. Install $pkg secara manual."
        exit 1
    fi
}

install_ffmpeg() {
    info "Memeriksa ffmpeg..."
    if cmd_exists ffmpeg; then
        success "ffmpeg sudah terinstall."
        return
    fi
    install_package ffmpeg
    if ! cmd_exists ffmpeg; then
        error "Gagal menginstall ffmpeg."
        exit 1
    fi
    success "ffmpeg berhasil diinstall."
}

install_curl() {
    info "Memeriksa curl..."
    if cmd_exists curl; then
        success "curl sudah terinstall."
        return
    fi
    install_package curl
    if ! cmd_exists curl; then
        error "Gagal menginstall curl."
        exit 1
    fi
    success "curl berhasil diinstall."
}

install_alsa() {
    info "Memeriksa ALSA utils..."
    if cmd_exists aplay; then
        success "ALSA utils sudah terinstall."
        return
    fi
    install_package alsa-utils
    success "ALSA utils berhasil diinstall."
}

create_project_dir() {
    info "Menyiapkan direktori proyek..."

    if [ -d "$PROJECT_DIR" ]; then
        warning "Direktori $PROJECT_DIR sudah ada."
        read -rp "Lanjutkan dan timpa file yang ada? [y/N]: " -n 1
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Instalasi dibatalkan."
            exit 1
        fi
    fi

    mkdir -p "$PROJECT_DIR/tone"
    mkdir -p "$PROJECT_DIR/data"
    mkdir -p "$PROJECT_DIR/static/icons"
    success "Direktori proyek: $PROJECT_DIR"
}

build_binary() {
    info "Membangun binary Go..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    for f in main.go auth.go handler.go storage.go pwa.go go.mod; do
        if [ ! -f "$SCRIPT_DIR/$f" ]; then
            error "$f tidak ditemukan di direktori installer ($SCRIPT_DIR)."
            exit 1
        fi
    done

    if [ -f "$SCRIPT_DIR/jadwal.go" ]; then
        warning "jadwal.go ditemukan dan akan dihapus (sudah digabung ke storage.go)."
        rm -f "$SCRIPT_DIR/jadwal.go"
    fi

    if ! (cd "$SCRIPT_DIR" && go build -o "$PROJECT_DIR/bel-madrasah" .); then
        error "Gagal membangun binary Go."
        exit 1
    fi

    chmod +x "$PROJECT_DIR/bel-madrasah"
    success "Binary berhasil dibangun: $PROJECT_DIR/bel-madrasah"
}

setup_nginx() {
    info "Mengkonfigurasi nginx reverse proxy..."

    if ! cmd_exists nginx; then
        install_package nginx
    fi

    local NGINX_CONF="/etc/nginx/sites-available/bel-madrasah"
    local NGINX_ENABLED="/etc/nginx/sites-enabled/bel-madrasah"

    cat > "$NGINX_CONF" << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 32M;

    location /static/ {
        proxy_pass         http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        expires            7d;
        add_header         Cache-Control "public, immutable";
    }

    location /sw.js {
        proxy_pass         http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        add_header         Cache-Control "no-cache";
    }

    location / {
        proxy_pass         http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
EOF

    ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

    if [ -f /etc/nginx/sites-enabled/default ]; then
        rm -f /etc/nginx/sites-enabled/default
        warning "Site default nginx dinonaktifkan."
    fi

    if nginx -t 2>/dev/null; then
        systemctl enable nginx
        systemctl reload nginx
        success "nginx dikonfigurasi dan direload."
    else
        error "Konfigurasi nginx tidak valid. Cek manual: nginx -t"
        exit 1
    fi
}

copy_static() {
    info "Menyalin file static..."
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [ -d "$SCRIPT_DIR/static" ]; then
        cp -r "$SCRIPT_DIR/static/." "$PROJECT_DIR/static/"
        success "File static disalin ke $PROJECT_DIR/static/"
    else
        warning "Direktori static tidak ditemukan, dilewati."
    fi

    mkdir -p "$PROJECT_DIR/static/icons"
}

generate_pwa_icons() {
    info "Memeriksa ikon PWA..."

    local missing=0
    for size in "${REQUIRED_ICON_SIZES[@]}"; do
        if [ ! -f "$PROJECT_DIR/static/icons/icon-$size.png" ]; then
            missing=1
        fi
    done
    for size in "${REQUIRED_MASKABLE_SIZES[@]}"; do
        if [ ! -f "$PROJECT_DIR/static/icons/icon-maskable-$size.png" ]; then
            missing=1
        fi
    done

    if [ "$missing" -eq 0 ]; then
        success "Seluruh ikon PWA sudah tersedia."
        return
    fi

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local SOURCE_ICON=""
    for candidate in "$SCRIPT_DIR/static/icons/source.png" "$SCRIPT_DIR/icon-source.png"; do
        if [ -f "$candidate" ]; then
            SOURCE_ICON="$candidate"
            break
        fi
    done

    if [ -z "$SOURCE_ICON" ]; then
        warning "Ikon PWA belum lengkap dan tidak ditemukan gambar sumber (icon-source.png)."
        warning "Aplikasi tetap berjalan normal, namun fitur 'Pasang ke Layar Utama' (PWA)"
        warning "tidak akan menampilkan ikon dengan benar sampai ikon disediakan."
        warning "Letakkan logo persegi 512x512 di $SCRIPT_DIR/icon-source.png dan jalankan ulang installer,"
        warning "atau salin manual berkas ikon ke $PROJECT_DIR/static/icons/."
        return
    fi

    if ! cmd_exists convert; then
        info "ImageMagick belum terinstall, mencoba menginstall untuk membuat ikon..."
        install_package imagemagick || true
    fi

    if ! cmd_exists convert; then
        warning "ImageMagick tidak tersedia. Ikon PWA tidak dibuat otomatis."
        warning "Salin manual berkas ikon ke $PROJECT_DIR/static/icons/."
        return
    fi

    info "Membuat ikon PWA dari $SOURCE_ICON..."
    for size in "${REQUIRED_ICON_SIZES[@]}"; do
        convert "$SOURCE_ICON" -resize "${size}x${size}" "$PROJECT_DIR/static/icons/icon-$size.png"
    done
    for size in "${REQUIRED_MASKABLE_SIZES[@]}"; do
        convert "$SOURCE_ICON" -resize "${size}x${size}" -gravity center -extent "${size}x${size}" \
            "$PROJECT_DIR/static/icons/icon-maskable-$size.png"
    done
    success "Ikon PWA berhasil dibuat di $PROJECT_DIR/static/icons/."
}

create_systemd_service() {
    info "Membuat systemd system service..."

    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Bel Madrasah Otomatis
After=sound.target
Wants=sound.target

[Service]
Type=simple
ExecStart=$PROJECT_DIR/bel-madrasah
Restart=always
RestartSec=10
User=root
StandardOutput=journal
StandardError=journal
WorkingDirectory=$PROJECT_DIR

[Install]
WantedBy=multi-user.target
EOF

    success "Service file dibuat: $SERVICE_FILE"
}

setup_service() {
    info "Mengkonfigurasi systemd service..."

    systemctl daemon-reload

    if ! systemctl enable "$SERVICE_NAME.service"; then
        error "Gagal mengaktifkan service."
        exit 1
    fi
    success "Service diaktifkan (auto-start saat boot)."
}

download_tone() {
    info "Mengunduh file audio..."

    BASE_URL="https://raw.githubusercontent.com/zulfikriyahya/bel-madrasah/main/tone"

    AUDIO_FILES=(
        "mars-madrasah.mp3"
        "upacara.mp3"
        "pelajaran-1.mp3"
        "pelajaran-2.mp3"
        "pelajaran-3.mp3"
        "pelajaran-4.mp3"
        "pelajaran-5.mp3"
        "pelajaran-6.mp3"
        "pelajaran-7.mp3"
        "pelajaran-8.mp3"
        "pelajaran-9.mp3"
        "pelajaran-10.mp3"
        "pelajaran-selesai.mp3"
        "indonesia-raya.mp3"
        "istirahat-1.mp3"
        "istirahat-2.mp3"
        "kebersihan.mp3"
        "hymne-madrasah.mp3"
        "literasi.mp3"
        "rohani.mp3"
        "akhir-pekan.mp3"
        "pramuka.mp3"
        "tanah-airku.mp3"
    )

    mkdir -p "$PROJECT_DIR/tone"

    SUCCESS_COUNT=0
    FAIL_COUNT=0

    for file in "${AUDIO_FILES[@]}"; do
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        if [ -f "$SCRIPT_DIR/tone/$file" ]; then
            cp "$SCRIPT_DIR/tone/$file" "$PROJECT_DIR/tone/$file"
            success "$file (lokal)"
            ((SUCCESS_COUNT++))
            continue
        fi

        if curl -f -L --silent --show-error -o "$PROJECT_DIR/tone/$file" "$BASE_URL/$file"; then
            success "$file"
            ((SUCCESS_COUNT++))
        else
            warning "Gagal: $file"
            ((FAIL_COUNT++))
        fi
    done

    echo
    info "Berhasil: $SUCCESS_COUNT | Gagal: $FAIL_COUNT"

    if [ "$FAIL_COUNT" -gt 0 ]; then
        warning "Beberapa file gagal diunduh. Unduh manual dari:"
        warning "https://github.com/zulfikriyahya/bel-madrasah/tree/main/tone"
    fi
}

detect_audio_device() {
    info "Mendeteksi perangkat audio ALSA..."
    if cmd_exists aplay; then
        echo
        aplay -l 2>/dev/null || warning "Tidak dapat mendeteksi perangkat audio."
        echo
        warning "Pastikan nilai alsaDev di main.go sesuai dengan perangkat audio Anda."
        warning "Default saat ini: hw:1,0"
    fi
}

set_permissions() {
    info "Mengatur izin file..."
    chown -R root:root "$PROJECT_DIR"
    chmod 755 "$PROJECT_DIR"
    chmod 755 "$PROJECT_DIR/tone"
    chmod 755 "$PROJECT_DIR/data"
    chmod 755 "$PROJECT_DIR/static"
    chmod 755 "$PROJECT_DIR/static/icons"
    chmod 755 "$PROJECT_DIR/bel-madrasah"
    chmod 644 "$PROJECT_DIR/tone/"*.mp3 2>/dev/null || true
    chmod 644 "$PROJECT_DIR/static/icons/"*.png 2>/dev/null || true
    success "Izin file diatur."
}

test_installation() {
    info "Memverifikasi instalasi..."

    if [ ! -f "$PROJECT_DIR/bel-madrasah" ]; then
        error "Binary tidak ditemukan di $PROJECT_DIR/bel-madrasah."
        exit 1
    fi
    success "Binary ditemukan."

    if [ ! -f "$PROJECT_DIR/static/index.html" ]; then
        warning "index.html tidak ditemukan di $PROJECT_DIR/static/."
    else
        success "File static ditemukan."
    fi

    if [ ! -f "$PROJECT_DIR/static/manifest.json" ] || [ ! -f "$PROJECT_DIR/static/sw.js" ]; then
        warning "Berkas PWA (manifest.json/sw.js) tidak lengkap."
    else
        success "Berkas PWA ditemukan."
    fi

    if ! systemctl is-enabled "$SERVICE_NAME.service" >/dev/null 2>&1; then
        error "Service belum diaktifkan."
        exit 1
    fi
    success "Service terdaftar di systemd."
}

start_service() {
    info "Menjalankan service..."

    if ! systemctl start "$SERVICE_NAME.service"; then
        error "Gagal menjalankan service."
        error "Cek log: journalctl -u $SERVICE_NAME -n 50"
        exit 1
    fi

    sleep 2
    success "Service berjalan."
    systemctl status "$SERVICE_NAME.service" --no-pager -l
}

show_completion() {
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

    echo
    echo "========================================="
    success "INSTALASI SELESAI"
    echo "========================================="
    echo
    info "Direktori  : $PROJECT_DIR"
    info "Binary     : $PROJECT_DIR/bel-madrasah"
    info "Service    : $SERVICE_NAME"
    echo
    if [ -n "$LOCAL_IP" ]; then
        info "Akses web  : http://$LOCAL_IP"
    fi
    info "Login      : admin / admin123"
    warning "Segera ganti password setelah login pertama!"
    echo
    info "Aplikasi mendukung PWA. Buka di Chrome/Edge pada perangkat tujuan,"
    info "lalu pilih 'Pasang Aplikasi' atau gunakan banner instalasi pada menu Pengaturan"
    info "untuk menambahkan ke layar utama dan mengaktifkan akses offline."
    echo
    echo "Perintah pengelolaan service:"
    echo "  sudo systemctl status  $SERVICE_NAME"
    echo "  sudo systemctl stop    $SERVICE_NAME"
    echo "  sudo systemctl start   $SERVICE_NAME"
    echo "  sudo systemctl restart $SERVICE_NAME"
    echo "  sudo journalctl -u $SERVICE_NAME -f"
    echo
}

main() {
    echo "========================================="
    echo "Bell System Madrasah - Installer"
    echo "MTsN 1 Pandeglang"
    echo "========================================="
    echo

    read -rp "Lanjutkan instalasi? [y/N]: " -n 1
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Instalasi dibatalkan."
        exit 1
    fi

    echo
    check_requirements
    install_ffmpeg
    install_curl
    install_alsa
    detect_audio_device
    create_project_dir
    build_binary
    copy_static
    generate_pwa_icons
    setup_nginx
    create_systemd_service
    setup_service
    download_tone
    set_permissions
    test_installation
    start_service
    show_completion
}

main "$@"

```
---

## main.go
```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

const (
	ffmpegBin = "/usr/bin/ffmpeg"
	alsaDev   = "hw:1,0"
	volume    = "0.85"
	sleepSec  = 20 * time.Second
	port      = ":8081"
	toneDir   = "/opt/bel-madrasah/tone"
	dataDir   = "/opt/bel-madrasah/data"
	staticDir = "/opt/bel-madrasah/static"
)

var (
	activeProcs []*exec.Cmd
	procMu      sync.Mutex

	schedulerRunning = true
	schedulerMu      sync.Mutex
)

func logMsg(msg string) {
	fmt.Printf("[%s] %s\n", time.Now().Format("2006-01-02 15:04:05"), msg)
}

func getHari() string {
	hariMap := map[time.Weekday]string{
		time.Monday:    "Senin",
		time.Tuesday:   "Selasa",
		time.Wednesday: "Rabu",
		time.Thursday:  "Kamis",
		time.Friday:    "Jumat",
	}
	return hariMap[time.Now().Weekday()]
}

func cleanupProcs() {
	procMu.Lock()
	defer procMu.Unlock()
	alive := activeProcs[:0]
	for _, p := range activeProcs {
		if p.ProcessState == nil {
			alive = append(alive, p)
		}
	}
	activeProcs = alive
}

func playSound(filePath string) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		logMsg(fmt.Sprintf("File tidak ditemukan: %s", filePath))
		return
	}
	cleanupProcs()
	cmd := exec.Command(
		ffmpegBin,
		"-hide_banner", "-loglevel", "error",
		"-i", filePath,
		"-filter:a", fmt.Sprintf("volume=%s", volume),
		"-f", "alsa", alsaDev,
	)
	if err := cmd.Start(); err != nil {
		logMsg(fmt.Sprintf("Gagal memutar audio: %s", err))
		return
	}
	procMu.Lock()
	activeProcs = append(activeProcs, cmd)
	procMu.Unlock()
	go func() { _ = cmd.Wait() }()
}

func runScheduler() {
	logMsg("Scheduler bel madrasah dimulai.")
	sudahDiputar := make(map[string]bool)
	hariSekarang := ""

	for {
		schedulerMu.Lock()
		running := schedulerRunning
		schedulerMu.Unlock()

		if !running {
			time.Sleep(sleepSec)
			continue
		}

		now := time.Now()
		hari := getHari()

		// Reset cache saat hari berganti
		if hari != hariSekarang {
			if hariSekarang != "" {
				sudahDiputar = make(map[string]bool)
				logMsg("Cache jadwal direset untuk hari baru.")
			}
			hariSekarang = hari
		}

		if hari == "" {
			time.Sleep(sleepSec)
			continue
		}

		// Cek config: libur & mode
		cfg, err := loadConfig()
		if err != nil {
			time.Sleep(sleepSec)
			continue
		}

		if isLibur(cfg) {
			time.Sleep(sleepSec)
			continue
		}

		mode := resolveMode(cfg)

		jadwal, err := loadJadwal()
		if err != nil {
			time.Sleep(sleepSec)
			continue
		}

		modeJadwal, ok := jadwal[mode]
		if !ok {
			time.Sleep(sleepSec)
			continue
		}

		jadwalHari, ok := modeJadwal[hari]
		if !ok {
			time.Sleep(sleepSec)
			continue
		}

		waktuSekarang := now.Format("15:04")
		for _, entry := range jadwalHari {
			key := fmt.Sprintf("%s-%s-%s", mode, hari, entry.Waktu)
			if waktuSekarang == entry.Waktu && !sudahDiputar[key] {
				logMsg(fmt.Sprintf("[%s] Memutar: %s [%s]", mode, filepath.Base(entry.Audio), entry.Waktu))
				playSound(entry.Audio)
				sudahDiputar[key] = true

				// Tulis activity log
				writeLog(ActivityLog{
					Time:  now.Format("2006-01-02 15:04:05"),
					Mode:  mode,
					Hari:  hari,
					Waktu: entry.Waktu,
					Audio: filepath.Base(entry.Audio),
				})
			}
		}

		time.Sleep(sleepSec)
	}
}

func main() {
	if _, err := os.Stat(ffmpegBin); os.IsNotExist(err) {
		log.Fatalf("ffmpeg tidak ditemukan di %s.", ffmpegBin)
	}

	for _, d := range []string{toneDir, dataDir, staticDir} {
		if err := os.MkdirAll(d, 0755); err != nil {
			log.Fatalf("Gagal membuat direktori %s: %s", d, err)
		}
	}

	if err := initStorage(); err != nil {
		log.Fatalf("Gagal inisialisasi storage: %s", err)
	}

	if err := initAuth(); err != nil {
		log.Fatalf("Gagal inisialisasi auth: %s", err)
	}

	go runScheduler()

	mux := http.NewServeMux()
	registerRoutes(mux)

	logMsg(fmt.Sprintf("Web server berjalan di port %s", port))
	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatalf("Server error: %s", err)
	}
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
  <title>Bel Madrasah — MTsN 1 Pandeglang</title>
  <meta name="description" content="Sistem bel otomatis MTsN 1 Pandeglang">
  <meta name="theme-color" content="#0c1a17">
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
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
    rel="stylesheet">
  <link rel="stylesheet" href="/static/style.css">
</head>

<body>

  <div class="splash" id="splash">
    <div class="splash-inner">
      <div class="splash-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <div class="splash-label">Bel Madrasah</div>
      <div class="splash-ring"></div>
    </div>
  </div>

  <div class="offline-bar" id="offlineBar">Tidak ada koneksi ke server</div>

  <header>
    <div class="brand">
      <div class="brand-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <div>
        <span class="brand-name">Bel Madrasah</span>
        <span class="brand-sub">MTsN 1 Pandeglang</span>
      </div>
    </div>
    <div class="header-controls">
      <div class="status-group">
        <span class="badge badge-mode reguler" id="modeBadge">Reguler</span>
        <span class="badge badge-libur" id="liburBadge" style="display:none">Libur</span>
        <div class="status-pill">
          <span class="dot" id="statusDot"></span>
          <span id="statusText">—</span>
        </div>
      </div>
      <button class="hbtn hbtn-primary" id="toggleBtn" onclick="toggleService()">—</button>
      <button class="hbtn" onclick="logout()">Keluar</button>
    </div>
  </header>

  <nav>
    <button class="nav-btn active" onclick="switchTab('jadwal',this)">Jadwal</button>
    <button class="nav-btn" onclick="switchTab('mode',this)">Mode Bel</button>
    <button class="nav-btn" onclick="switchTab('libur',this)">Hari Libur</button>
    <button class="nav-btn" onclick="switchTab('log',this)">Log</button>
    <button class="nav-btn" onclick="switchTab('audio',this)">Audio</button>
    <button class="nav-btn" onclick="switchTab('settings',this)">Pengaturan</button>
  </nav>

  <main>

    <div class="section active" id="sec-jadwal">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Jadwal Bel</div>
            <div class="card-desc">Kelola entri bel per hari dan mode pembelajaran</div>
          </div>
        </div>
        <div class="mode-tabs">
          <button class="mtab active reguler" onclick="switchJadwalMode('reguler',this)">Reguler</button>
          <button class="mtab ramadhan" onclick="switchJadwalMode('ramadhan',this)">Ramadhan</button>
          <button class="mtab pts" onclick="switchJadwalMode('pts',this)">PTS</button>
          <button class="mtab pas" onclick="switchJadwalMode('pas',this)">PAS</button>
        </div>
        <div class="row-form">
          <div class="fg fg-grow">
            <label>Tambah Hari</label>
            <input type="text" id="newHariInput" placeholder="Contoh: Sabtu">
          </div>
          <button class="btn primary" onclick="addHari()">Tambah Hari</button>
        </div>
        <div class="hari-tabs" id="hariTabs"></div>
      </div>

      <div class="card" id="jadwalCard">
        <div class="card-head">
          <div>
            <div class="card-title" id="jadwalTitle">Pilih hari</div>
            <div class="card-desc" id="hariInfo"></div>
          </div>
          <div class="btn-row" id="jadwalActions" style="display:none">
            <button class="btn ghost sm" onclick="deleteHari()">Hapus Hari</button>
            <button class="btn primary sm" onclick="openAddEntry()">Tambah Bel</button>
          </div>
        </div>
        <div id="jadwalTable">
          <div class="empty">Pilih hari dari daftar di atas</div>
        </div>
      </div>
    </div>

    <div class="section" id="sec-mode">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Mode Aktif</div>
            <div class="card-desc">Pilih mode yang digunakan saat override manual diaktifkan</div>
          </div>
        </div>
        <div class="mode-grid">
          <div class="mode-opt" id="modeOptReguler" onclick="selectMode('reguler')">
            <div class="mode-indicator"></div>
            <div class="mode-name">Reguler</div>
            <div class="mode-hint">Jadwal harian normal</div>
          </div>
          <div class="mode-opt ramadhan" id="modeOptRamadhan" onclick="selectMode('ramadhan')">
            <div class="mode-indicator"></div>
            <div class="mode-name">Ramadhan</div>
            <div class="mode-hint">Jadwal bulan Ramadhan</div>
          </div>
          <div class="mode-opt pts" id="modeOptPTS" onclick="selectMode('pts')">
            <div class="mode-indicator"></div>
            <div class="mode-name">PTS</div>
            <div class="mode-hint">Penilaian Tengah Semester</div>
          </div>
          <div class="mode-opt pas" id="modeOptPAS" onclick="selectMode('pas')">
            <div class="mode-indicator"></div>
            <div class="mode-name">PAS</div>
            <div class="mode-hint">Penilaian Akhir Semester</div>
          </div>
        </div>
        <div class="toggle-row">
          <div>
            <div class="toggle-label">Override Manual</div>
            <div class="toggle-hint">Paksa mode di atas, abaikan jadwal otomatis berbasis tanggal</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="overrideToggle" onchange="onOverrideChange()">
            <span class="track"></span>
          </label>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Jadwal Otomatis Ramadhan</div>
            <div class="card-desc">Format MM-DD, berlaku setiap tahun</div>
          </div>
        </div>
        <div class="two-col">
          <div class="fg">
            <label>Mulai</label>
            <input type="text" id="ramadhanStart" placeholder="03-01" maxlength="5">
          </div>
          <div class="fg">
            <label>Akhir</label>
            <input type="text" id="ramadhanEnd" placeholder="03-31" maxlength="5">
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Jadwal Otomatis PTS</div>
            <div class="card-desc">Diprioritaskan di atas mode Ramadhan jika tanggal bertumpang tindih</div>
          </div>
        </div>
        <div class="two-col">
          <div class="fg">
            <label>Mulai PTS</label>
            <input type="date" id="ptsStart">
          </div>
          <div class="fg">
            <label>Akhir PTS</label>
            <input type="date" id="ptsEnd">
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Jadwal Otomatis PAS</div>
            <div class="card-desc">Diprioritaskan di atas mode Ramadhan jika tanggal bertumpang tindih</div>
          </div>
        </div>
        <div class="two-col">
          <div class="fg">
            <label>Mulai PAS</label>
            <input type="date" id="pasStart">
          </div>
          <div class="fg">
            <label>Akhir PAS</label>
            <input type="date" id="pasEnd">
          </div>
        </div>
        <div style="margin-top:22px">
          <button class="btn primary" onclick="saveConfig()">Simpan Pengaturan</button>
        </div>
      </div>
    </div>

    <div class="section" id="sec-libur">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Tambah Hari Libur</div>
            <div class="card-desc">Bel tidak akan berbunyi pada tanggal yang terdaftar</div>
          </div>
        </div>
        <div class="notice warning">Scheduler akan melewati seluruh entri jadwal pada tanggal yang ditandai sebagai hari
          libur.</div>
        <div class="row-form">
          <div class="fg fg-grow">
            <label>Tanggal</label>
            <input type="date" id="newLiburDate">
          </div>
          <button class="btn primary" onclick="addLibur()">Tambah</button>
        </div>
      </div>
      <div class="card">
        <div class="card-head">
          <div class="card-title">Daftar Hari Libur</div>
          <span class="count" id="liburCount">0</span>
        </div>
        <div id="liburList">
          <div class="empty">Memuat...</div>
        </div>
      </div>
    </div>

    <div class="section" id="sec-log">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Log Aktivitas</div>
            <div class="card-desc">Riwayat bel yang telah diputar</div>
          </div>
          <button class="btn ghost sm" onclick="loadLog()">Perbarui</button>
        </div>
        <div id="logContainer">
          <div class="empty">Memuat...</div>
        </div>
      </div>
    </div>

    <div class="section" id="sec-audio">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Unggah File Audio</div>
            <div class="card-desc">Format yang didukung: MP3, WAV, OGG — Maks. 32 MB</div>
          </div>
        </div>
        <div class="upload-zone" id="uploadZone" onclick="document.getElementById('fileInput').click()"
          ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')"
          ondrop="handleDrop(event)">
          <div class="upload-zone-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6">
              <path d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16" />
            </svg>
          </div>
          <p>Klik atau seret file audio ke sini</p>
          <small>MP3, WAV, OGG — Maks. 32 MB</small>
        </div>
        <input type="file" id="fileInput" accept=".mp3,.wav,.ogg" onchange="uploadFile(this.files[0])">
      </div>
      <div class="card">
        <div class="card-head">
          <div class="card-title">Daftar File Audio</div>
          <span class="count" id="toneCount">0</span>
        </div>
        <div id="toneList">
          <div class="empty">Memuat...</div>
        </div>
      </div>
    </div>

    <div class="section" id="sec-settings">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Pasang Aplikasi</div>
            <div class="card-desc">Tambahkan ke layar utama untuk akses cepat tanpa browser</div>
          </div>
        </div>
        <button class="btn primary" id="installAppBtn" onclick="promptInstall()" style="display:none">Pasang
          Aplikasi</button>
        <span class="card-desc" id="installInfo">Aplikasi sudah terpasang atau tidak didukung di perangkat ini.</span>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Backup dan Restore</div>
            <div class="card-desc">Ekspor atau impor seluruh data jadwal dalam format JSON</div>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn success" onclick="downloadBackup()">Unduh Backup</button>
          <label class="btn warning" style="cursor:pointer">
            Restore dari File
            <input type="file" accept=".json" style="display:none" onchange="restoreBackup(this.files[0])">
          </label>
        </div>
        <div class="card-desc" style="margin-top:14px">Mencakup jadwal reguler, Ramadhan, PTS, dan PAS.</div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Ganti Password</div>
            <div class="card-desc">Minimal 6 karakter</div>
          </div>
        </div>
        <div class="fg" style="margin-bottom:14px">
          <label>Password Lama</label>
          <input type="password" id="oldPass" placeholder="Password saat ini">
        </div>
        <div class="two-col" style="margin-bottom:18px">
          <div class="fg">
            <label>Password Baru</label>
            <input type="password" id="newPass" placeholder="Min. 6 karakter">
          </div>
          <div class="fg">
            <label>Konfirmasi</label>
            <input type="password" id="confirmPass" placeholder="Ulangi password baru">
          </div>
        </div>
        <button class="btn primary" onclick="changePassword()">Perbarui Password</button>
      </div>
    </div>

  </main>

  <div class="overlay" id="entryModal">
    <div class="modal">
      <div class="modal-head">
        <div class="modal-title" id="modalTitle">Tambah Bel</div>
        <div class="modal-subtitle" id="modalSubtitle"></div>
      </div>
      <div class="fg" style="margin-bottom:14px">
        <label>Waktu</label>
        <input type="time" id="entryWaktu">
      </div>
      <div class="fg">
        <label>File Audio</label>
        <select id="entryAudio"></select>
      </div>
      <div class="modal-foot">
        <button class="btn ghost" onclick="closeModal()">Batal</button>
        <button class="btn primary" onclick="saveEntry()">Simpan</button>
      </div>
    </div>
  </div>

  <div class="pwa-banner" id="pwaBanner">
    <div class="pwa-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6">
        <path d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16" />
      </svg>
    </div>
    <div class="pwa-text">
      <div class="pwa-title">Pasang Bel Madrasah</div>
      <div class="pwa-desc">Tambahkan ke layar utama untuk akses cepat</div>
    </div>
    <div class="pwa-actions">
      <button class="btn ghost sm" onclick="dismissBanner()">Nanti</button>
      <button class="btn primary sm" onclick="promptInstall()">Pasang</button>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script src="/static/script.js"></script>
</body>

</html>

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
  <meta name="theme-color" content="#0c1a17">
  <link rel="manifest" href="/static/manifest.json">
  <link rel="icon" href="/static/icons/icon-192.png">
  <link rel="apple-touch-icon" href="/static/icons/icon-192.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@700;800&display=swap"
    rel="stylesheet">
  <style>
    *,
    *::before,
    *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #0c1a17;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
    }

    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background:
        radial-gradient(circle at 25% 25%, rgba(15, 118, 110, .15), transparent 50%),
        radial-gradient(circle at 75% 75%, rgba(15, 118, 110, .08), transparent 50%);
      pointer-events: none;
    }

    .card {
      position: relative;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 32px 64px rgba(0, 0, 0, .4), 0 4px 16px rgba(0, 0, 0, .2);
      padding: 40px 36px;
      width: min(380px, 100%);
      animation: pop .35s cubic-bezier(.34, 1.56, .64, 1);
    }

    @keyframes pop {
      from {
        opacity: 0;
        transform: translateY(16px) scale(.97);
      }

      to {
        opacity: 1;
        transform: none;
      }
    }

    .logo {
      text-align: center;
      margin-bottom: 32px;
    }

    .logo-mark {
      width: 54px;
      height: 54px;
      border-radius: 17px;
      background: #f0fdf9;
      border: 1px solid #ccfbef;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .logo-mark svg {
      width: 24px;
      height: 24px;
      stroke: #0f766e;
    }

    .logo h1 {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 18px;
      font-weight: 800;
      color: #1c1917;
      letter-spacing: -.02em;
    }

    .logo p {
      font-size: 12px;
      color: #a8a29e;
      margin-top: 4px;
    }

    .error {
      background: #fef2f2;
      border: 1px solid #fca5a5;
      color: #991b1b;
      border-radius: 9px;
      padding: 11px 14px;
      font-size: 12.5px;
      font-weight: 500;
      margin-bottom: 18px;
      display: none;
      line-height: 1.4;
    }

    .fg {
      margin-bottom: 14px;
    }

    label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: #78716c;
      text-transform: uppercase;
      letter-spacing: .07em;
      margin-bottom: 7px;
    }

    input {
      width: 100%;
      padding: 10px 13px;
      border: 1px solid #e7e5e4;
      border-radius: 9px;
      font-size: 14px;
      font-family: inherit;
      color: #1c1917;
      outline: none;
      transition: border-color .15s, box-shadow .15s;
      background: #fff;
      -webkit-appearance: none;
    }

    input:focus {
      border-color: #0f766e;
      box-shadow: 0 0 0 3px rgba(15, 118, 110, .1);
    }

    input::placeholder {
      color: #d6d3d1;
    }

    .btn {
      width: 100%;
      padding: 11px;
      margin-top: 8px;
      background: #0f766e;
      color: #fff;
      border: none;
      border-radius: 9px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      box-shadow: 0 2px 8px rgba(15, 118, 110, .3);
      transition: background .2s, transform .1s;
      letter-spacing: -.01em;
    }

    .btn:hover {
      background: #0d6460;
    }

    .btn:active {
      transform: scale(.98);
    }

    .btn:disabled {
      background: #d6d3d1;
      box-shadow: none;
      cursor: not-allowed;
    }

    .footer {
      text-align: center;
      font-size: 11px;
      color: #d6d3d1;
      margin-top: 24px;
    }
  </style>
</head>

<body>
  <div class="card">
    <div class="logo">
      <div class="logo-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.6">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <h1>Bel Madrasah</h1>
      <p>MTsN 1 Pandeglang</p>
    </div>

    <div class="error" id="errMsg"></div>

    <div class="fg">
      <label>Username</label>
      <input type="text" id="username" placeholder="admin" autocomplete="username">
    </div>
    <div class="fg">
      <label>Password</label>
      <input type="password" id="password" placeholder="Masukkan password" autocomplete="current-password"
        onkeydown="if(event.key==='Enter')login()">
    </div>
    <button class="btn" id="loginBtn" onclick="login()">Masuk</button>
    <div class="footer">Sistem Bel Otomatis Madrasah</div>
  </div>

  <script>
    async function login() {
      const btn = document.getElementById("loginBtn");
      const err = document.getElementById("errMsg");
      const u = document.getElementById("username").value.trim();
      const p = document.getElementById("password").value;
      if (!u || !p) { showErr("Username dan password harus diisi"); return; }
      btn.disabled = true;
      btn.textContent = "Memproses...";
      err.style.display = "none";
      try {
        const res = await fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u, password: p }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.location.href = "/";
      } catch (e) {
        showErr(e.message);
        btn.disabled = false;
        btn.textContent = "Masuk";
      }
    }

    function showErr(msg) {
      const el = document.getElementById("errMsg");
      el.textContent = msg;
      el.style.display = "block";
    }

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => { }));
    }
  </script>
</body>

</html>

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
      "src": "/static/icons/icon-72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/static/icons/icon-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/static/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
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
const MODE_LABELS = { reguler: "Reguler", ramadhan: "Ramadhan", pts: "PTS", pas: "PAS" };
const DAY_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

let currentJadwalMode = "reguler";
let currentHari = null;
let editIndex = -1;
let allTones = [];
let jadwalData = {};
let configData = {};
let deferredInstall = null;

function toast(msg, type = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.className = "toast"), 3000);
}

async function api(url, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Terjadi kesalahan");
  return data;
}

function switchTab(id, btn) {
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.getElementById("sec-" + id).classList.add("active");
  btn.classList.add("active");
  if (id === "audio") loadTones();
  if (id === "log") loadLog();
  if (id === "libur") loadLibur();
  if (id === "mode") renderModeUI();
}

function logout() {
  window.location.href = "/logout";
}

async function loadStatus() {
  try {
    const d = await api("/api/service/status");
    const dot = document.getElementById("statusDot");
    dot.className = "dot" + (d.running ? " on" : "");
    document.getElementById("statusText").textContent = d.running ? "Aktif" : "Nonaktif";
    document.getElementById("toggleBtn").textContent = d.running ? "Hentikan" : "Aktifkan";

    const mode = d.active_mode || "reguler";
    const badge = document.getElementById("modeBadge");
    badge.textContent = MODE_LABELS[mode] || mode;
    badge.className = "badge badge-mode " + mode;

    const liburBadge = document.getElementById("liburBadge");
    liburBadge.style.display = d.is_libur ? "" : "none";
  } catch (_) {}
}

async function toggleService() {
  try {
    const d = await api("/api/service/toggle", "POST");
    toast(d.message);
    loadStatus();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function loadConfig() {
  try {
    const d = await api("/api/config");
    configData = d.config;
    return d;
  } catch (e) {
    toast(e.message, "error");
  }
}

function renderModeUI() {
  if (!configData.mode) return;
  const m = configData.mode;
  const map = {
    reguler: "modeOptReguler",
    ramadhan: "modeOptRamadhan",
    pts: "modeOptPTS",
    pas: "modeOptPAS",
  };

  ["reguler", "ramadhan", "pts", "pas"].forEach((k) => {
    const el = document.getElementById(map[k]);
    const base = k === "reguler" ? "mode-opt" : `mode-opt ${k}`;
    el.className = base + (m === k ? " active" : "");
  });

  document.getElementById("overrideToggle").checked = configData.manual_override;
  document.getElementById("ramadhanStart").value = configData.ramadhan_start || "";
  document.getElementById("ramadhanEnd").value = configData.ramadhan_end || "";
  document.getElementById("ptsStart").value = configData.pts_start || "";
  document.getElementById("ptsEnd").value = configData.pts_end || "";
  document.getElementById("pasStart").value = configData.pas_start || "";
  document.getElementById("pasEnd").value = configData.pas_end || "";
}

function selectMode(mode) {
  configData.mode = mode;
  renderModeUI();
}

function onOverrideChange() {
  configData.manual_override = document.getElementById("overrideToggle").checked;
}

async function saveConfig() {
  const start = document.getElementById("ramadhanStart").value.trim();
  const end = document.getElementById("ramadhanEnd").value.trim();
  const mmdd = /^\d{2}-\d{2}$/;

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
      manual_override: document.getElementById("overrideToggle").checked,
      ramadhan_start: start,
      ramadhan_end: end,
      pts_start: document.getElementById("ptsStart").value,
      pts_end: document.getElementById("ptsEnd").value,
      pas_start: document.getElementById("pasStart").value,
      pas_end: document.getElementById("pasEnd").value,
    });
    toast("Pengaturan disimpan");
    loadStatus();
    await loadConfig();
    renderModeUI();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function loadLibur() {
  try {
    const d = await api("/api/libur");
    const list = d.libur || [];
    document.getElementById("liburCount").textContent = list.length;
    const c = document.getElementById("liburList");
    if (!list.length) {
      c.innerHTML = '<div class="empty">Belum ada hari libur terdaftar</div>';
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    c.innerHTML = list
      .map((date) => {
        const isToday = date === today;
        return `<div class="libur-item${isToday ? " today" : ""}">
        <div class="libur-date">${formatDate(date)}${isToday ? '<span class="today-tag">Hari Ini</span>' : ""}</div>
        <button class="btn danger sm" onclick="deleteLibur('${date}')">Hapus</button>
      </div>`;
      })
      .join("");
  } catch (e) {
    toast(e.message, "error");
  }
}

function formatDate(d) {
  const mon = [
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
  const day = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const [y, m, dd] = d.split("-");
  return `${day[new Date(d).getDay()]}, ${parseInt(dd)} ${mon[parseInt(m)]} ${y}`;
}

async function addLibur() {
  const date = document.getElementById("newLiburDate").value;
  if (!date) {
    toast("Pilih tanggal terlebih dahulu", "error");
    return;
  }
  try {
    await api("/api/libur", "POST", { action: "add", date });
    toast("Tanggal libur ditambahkan");
    document.getElementById("newLiburDate").value = "";
    loadLibur();
    loadStatus();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteLibur(date) {
  if (!confirm(`Hapus ${formatDate(date)} dari daftar libur?`)) return;
  try {
    await api("/api/libur", "POST", { action: "delete", date });
    toast("Tanggal libur dihapus");
    loadLibur();
    loadStatus();
  } catch (e) {
    toast(e.message, "error");
  }
}

function switchJadwalMode(mode, btn) {
  currentJadwalMode = mode;
  currentHari = null;
  document.querySelectorAll(".mtab").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  loadJadwal();
}

async function loadJadwal() {
  try {
    const d = await api("/api/jadwal?mode=" + currentJadwalMode);
    jadwalData = d.jadwal || {};
    renderHariTabs(Object.keys(jadwalData));
    if (currentHari && jadwalData[currentHari]) {
      renderJadwalTable(currentHari);
    } else {
      currentHari = null;
      document.getElementById("jadwalTitle").textContent = "Pilih hari";
      document.getElementById("hariInfo").textContent = "";
      document.getElementById("jadwalTable").innerHTML =
        '<div class="empty">Pilih hari untuk melihat jadwal bel</div>';
      document.getElementById("jadwalActions").style.display = "none";
    }
  } catch (e) {
    toast(e.message, "error");
  }
}

function renderHariTabs(days) {
  const c = document.getElementById("hariTabs");
  if (!days.length) {
    c.innerHTML =
      '<span style="font-size:12px;color:var(--ink-4)">Belum ada hari. Tambahkan di atas.</span>';
    return;
  }
  days.sort((a, b) => {
    const ai = DAY_ORDER.indexOf(a),
      bi = DAY_ORDER.indexOf(b);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  c.innerHTML = days
    .map(
      (h) =>
        `<button class="hari-tab${h === currentHari ? " active" : ""}" onclick="selectHari('${h}')">${h}</button>`
    )
    .join("");
}

function selectHari(hari) {
  currentHari = hari;
  document
    .querySelectorAll(".hari-tab")
    .forEach((b) => b.classList.toggle("active", b.textContent === hari));
  renderJadwalTable(hari);
  document.getElementById("jadwalActions").style.display = "";
}

function renderJadwalTable(hari) {
  document.getElementById("jadwalTitle").textContent =
    `${hari} \u2014 ${MODE_LABELS[currentJadwalMode] || currentJadwalMode}`;
  const entries = jadwalData[hari] || [];
  document.getElementById("hariInfo").textContent = `${entries.length} entri`;

  if (!entries.length) {
    document.getElementById("jadwalTable").innerHTML =
      '<div class="empty">Belum ada jadwal bel untuk hari ini</div>';
    return;
  }

  let html = `<div class="table-wrap"><table><thead><tr>
    <th style="width:32px">#</th><th>Waktu</th><th>Audio</th><th style="width:120px">Aksi</th>
  </tr></thead><tbody>`;

  entries.forEach((e, i) => {
    const name = e.audio.split("/").pop();
    html += `<tr>
      <td class="t-num">${i + 1}</td>
      <td class="t-time">${e.waktu}</td>
      <td class="t-audio">${name}</td>
      <td><div class="btn-row">
        <button class="btn ghost sm" onclick="openEditEntry(${i})">Edit</button>
        <button class="btn danger sm" onclick="deleteEntry(${i})">Hapus</button>
      </div></td>
    </tr>`;
  });

  html += "</tbody></table></div>";
  document.getElementById("jadwalTable").innerHTML = html;
}

async function addHari() {
  const input = document.getElementById("newHariInput");
  const hari = input.value.trim();
  if (!hari) {
    toast("Nama hari tidak boleh kosong", "error");
    return;
  }
  try {
    await api("/api/jadwal/hari", "POST", { action: "add", mode: currentJadwalMode, hari });
    toast(`Hari ${hari} ditambahkan`);
    input.value = "";
    await loadJadwal();
    selectHari(hari);
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteHari() {
  if (!currentHari) return;
  if (!confirm(`Hapus hari ${currentHari} beserta seluruh jadwalnya?`)) return;
  try {
    await api("/api/jadwal/hari", "POST", {
      action: "delete",
      mode: currentJadwalMode,
      hari: currentHari,
    });
    toast(`Hari ${currentHari} dihapus`);
    currentHari = null;
    await loadJadwal();
  } catch (e) {
    toast(e.message, "error");
  }
}

function openAddEntry() {
  editIndex = -1;
  document.getElementById("modalTitle").textContent = `Tambah Bel`;
  document.getElementById("modalSubtitle").textContent =
    `${currentHari} \u2014 ${MODE_LABELS[currentJadwalMode]}`;
  document.getElementById("entryWaktu").value = "";
  populateAudioSelect("");
  document.getElementById("entryModal").classList.add("open");
}

function openEditEntry(idx) {
  editIndex = idx;
  const entry = jadwalData[currentHari][idx];
  document.getElementById("modalTitle").textContent = `Edit Bel`;
  document.getElementById("modalSubtitle").textContent =
    `${currentHari} \u2014 ${MODE_LABELS[currentJadwalMode]}`;
  document.getElementById("entryWaktu").value = entry.waktu;
  populateAudioSelect(entry.audio);
  document.getElementById("entryModal").classList.add("open");
}

function populateAudioSelect(current) {
  const sel = document.getElementById("entryAudio");
  sel.innerHTML = allTones
    .map((t) => {
      const fp = "/opt/bel-madrasah/tone/" + t;
      return `<option value="${fp}"${current === fp ? " selected" : ""}>${t}</option>`;
    })
    .join("");
}

function closeModal() {
  document.getElementById("entryModal").classList.remove("open");
}

async function saveEntry() {
  const waktu = document.getElementById("entryWaktu").value;
  const audio = document.getElementById("entryAudio").value;
  if (!waktu) {
    toast("Waktu harus diisi", "error");
    return;
  }
  if (!audio) {
    toast("Pilih file audio", "error");
    return;
  }
  const action = editIndex === -1 ? "add" : "edit";
  try {
    await api("/api/jadwal/entry", "POST", {
      action,
      mode: currentJadwalMode,
      hari: currentHari,
      index: editIndex,
      entry: { waktu, audio },
    });
    toast(action === "add" ? "Bel ditambahkan" : "Bel diperbarui");
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
      mode: currentJadwalMode,
      hari: currentHari,
      index: idx,
      entry: {},
    });
    toast("Entri dihapus");
    await loadJadwal();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function loadLog() {
  const c = document.getElementById("logContainer");
  try {
    const d = await api("/api/log");
    const logs = d.logs || [];
    if (!logs.length) {
      c.innerHTML = '<div class="empty">Belum ada aktivitas tercatat</div>';
      return;
    }

    let html = `<div class="table-wrap"><table><thead><tr>
      <th>Waktu</th><th>Mode</th><th>Hari</th><th>Jam</th><th>Audio</th>
    </tr></thead><tbody>`;

    logs.forEach((l) => {
      html += `<tr>
        <td style="white-space:nowrap;color:var(--ink-4);font-size:11.5px">${l.time}</td>
        <td><span class="log-badge ${l.mode}">${MODE_LABELS[l.mode] || l.mode}</span></td>
        <td style="font-size:13px">${l.hari}</td>
        <td class="t-time">${l.waktu}</td>
        <td class="t-audio">${l.audio}</td>
      </tr>`;
    });

    html += "</tbody></table></div>";
    c.innerHTML = html;
  } catch (e) {
    toast(e.message, "error");
  }
}

async function loadTones() {
  try {
    const d = await api("/api/tones");
    allTones = d.tones || [];
    document.getElementById("toneCount").textContent = allTones.length;
    const list = document.getElementById("toneList");
    if (!allTones.length) {
      list.innerHTML = '<div class="empty">Belum ada file audio</div>';
      return;
    }

    list.innerHTML = allTones
      .map(
        (f) => `
      <div class="tone-item">
        <span class="tone-name">${f}</span>
        <div class="btn-row">
          <button class="btn success sm" onclick="previewTone('${f}')">Putar</button>
          <button class="btn danger sm"  onclick="deleteTone('${f}')">Hapus</button>
        </div>
      </div>`
      )
      .join("");
  } catch (e) {
    toast(e.message, "error");
  }
}

async function uploadFile(file) {
  if (!file) return;
  const fd = new FormData();
  fd.append("file", file);
  try {
    toast("Mengunggah " + file.name + "...");
    const res = await fetch("/api/tones/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast(data.message);
    document.getElementById("fileInput").value = "";
    loadTones();
  } catch (e) {
    toast(e.message, "error");
  }
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById("uploadZone").classList.remove("over");
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
}

async function previewTone(filename) {
  try {
    await api("/api/tones/preview", "POST", { filename });
    toast("Memutar " + filename);
  } catch (e) {
    toast(e.message, "error");
  }
}

async function deleteTone(filename) {
  if (!confirm(`Hapus file ${filename}?`)) return;
  try {
    await api("/api/tones/delete", "POST", { filename });
    toast(filename + " berhasil dihapus");
    loadTones();
  } catch (e) {
    toast(e.message, "error");
  }
}

function downloadBackup() {
  window.location.href = "/api/backup";
}

async function restoreBackup(file) {
  if (!file) return;
  if (!confirm("Restore akan mengganti seluruh jadwal yang ada. Lanjutkan?")) return;
  const fd = new FormData();
  fd.append("file", file);
  try {
    toast("Merestore jadwal...");
    const res = await fetch("/api/restore", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast(data.message);
    await loadJadwal();
  } catch (e) {
    toast(e.message, "error");
  }
}

async function changePassword() {
  const old = document.getElementById("oldPass").value;
  const nw = document.getElementById("newPass").value;
  const cf = document.getElementById("confirmPass").value;
  if (nw !== cf) {
    toast("Konfirmasi password tidak cocok", "error");
    return;
  }
  if (nw.length < 6) {
    toast("Password baru minimal 6 karakter", "error");
    return;
  }
  try {
    const d = await api("/api/change-password", "POST", { old_password: old, new_password: nw });
    toast(d.message);
    ["oldPass", "newPass", "confirmPass"].forEach((id) => (document.getElementById(id).value = ""));
  } catch (e) {
    toast(e.message, "error");
  }
}

function setupOffline() {
  const bar = document.getElementById("offlineBar");
  const update = () => bar.classList.toggle("show", !navigator.onLine);
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

function setupPWA() {
  const banner = document.getElementById("pwaBanner");
  const btn = document.getElementById("installAppBtn");
  const info = document.getElementById("installInfo");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
    if (btn) {
      btn.style.display = "";
      if (info) info.style.display = "none";
    }
    if (banner) setTimeout(() => banner.classList.add("show"), 1800);
  });

  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    if (banner) banner.classList.remove("show");
    if (btn) btn.style.display = "none";
    if (info) {
      info.textContent = "Aplikasi sudah terpasang.";
      info.style.display = "";
    }
  });
}

function dismissBanner() {
  const banner = document.getElementById("pwaBanner");
  if (banner) banner.classList.remove("show");
}

async function promptInstall() {
  dismissBanner();
  if (!deferredInstall) {
    toast("Instalasi tidak tersedia di perangkat ini", "error");
    return;
  }
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
}

function applyTabFromQuery() {
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (!tab) return;
  const btn = Array.from(document.querySelectorAll(".nav-btn")).find(
    (b) => b.getAttribute("onclick") && b.getAttribute("onclick").includes(`'${tab}'`)
  );
  if (btn) switchTab(tab, btn);
}

window.addEventListener("click", (e) => {
  if (e.target === document.getElementById("entryModal")) closeModal();
});

(async () => {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () =>
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    );
  }
  setupOffline();
  setupPWA();
  applyTabFromQuery();
  await Promise.all([loadStatus(), loadJadwal(), loadTones(), loadConfig()]);
  setInterval(loadStatus, 10000);
  const splash = document.getElementById("splash");
  if (splash) splash.classList.add("gone");
})();

```
---

## static/style.css
```css
:root {
  --ink: #1c1917;
  --ink-2: #44403c;
  --ink-3: #78716c;
  --ink-4: #a8a29e;
  --ink-5: #d6d3d1;
  --bg: #faf9f7;
  --bg-2: #f5f3f0;
  --surface: #ffffff;
  --surface-2: #fdf9f6;
  --border: #e8e3dd;
  --border-2: #f0ece8;

  --teal: #0f766e;
  --teal-d: #0d6460;
  --teal-l: #f0fdf9;
  --teal-m: #ccfbef;
  --teal-b: #99f6e4;

  --amber: #92400e;
  --amber-d: #78350f;
  --amber-l: #fffbeb;
  --amber-m: #fef3c7;
  --amber-b: #fde68a;

  --green: #166534;
  --green-l: #f0fdf4;
  --green-m: #dcfce7;
  --green-b: #86efac;

  --red: #991b1b;
  --red-l: #fef2f2;
  --red-m: #fee2e2;
  --red-b: #fca5a5;

  --violet: #5b21b6;
  --violet-l: #f5f3ff;
  --violet-m: #ede9fe;

  --rose: #9f1239;
  --rose-l: #fff1f2;
  --rose-m: #ffe4e6;

  --brand: #0f766e;
  --brand-d: #0d6460;

  --r: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 20px;

  --sh: 0 1px 2px rgba(0, 0, 0, .05);
  --sh-md: 0 4px 8px rgba(0, 0, 0, .06), 0 1px 3px rgba(0, 0, 0, .04);
  --sh-lg: 0 12px 24px rgba(0, 0, 0, .08), 0 4px 8px rgba(0, 0, 0, .04);
  --sh-xl: 0 24px 48px rgba(0, 0, 0, .12), 0 8px 16px rgba(0, 0, 0, .06);

  --header-h: 64px;
  --nav-h: 48px;
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
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--ink);
  font-size: 14px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
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
  border-radius: 6px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--ink-5);
}

/* SPLASH */
.splash {
  position: fixed;
  inset: 0;
  background: #0c1a17;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  transition: opacity .5s ease, visibility .5s ease;
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
  gap: 24px;
}

.splash-mark {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: rgba(15, 118, 110, .2);
  border: 1px solid rgba(15, 118, 110, .3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.splash-mark svg {
  width: 26px;
  height: 26px;
  stroke: #5eead4;
}

.splash-label {
  color: rgba(255, 255, 255, .5);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.splash-ring {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, .1);
  border-top-color: #5eead4;
  animation: spin .7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* OFFLINE BAR */
.offline-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 300;
  background: var(--amber);
  color: #fff;
  text-align: center;
  font-size: 11.5px;
  font-weight: 600;
  padding: 6px 16px;
  letter-spacing: .01em;
  transform: translateY(-100%);
  transition: transform .3s ease;
}

.offline-bar.show {
  transform: translateY(0);
}

/* HEADER */
header {
  background: #0c1a17;
  height: var(--header-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  gap: 16px;
  position: sticky;
  top: 0;
  z-index: 200;
  border-bottom: 1px solid rgba(255, 255, 255, .06);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  flex-shrink: 0;
  background: rgba(94, 234, 212, .08);
  border: 1px solid rgba(94, 234, 212, .15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-mark svg {
  width: 17px;
  height: 17px;
  stroke: #5eead4;
}

.brand-name {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -.01em;
  display: block;
}

.brand-sub {
  font-size: 10.5px;
  color: rgba(255, 255, 255, .35);
  display: block;
  margin-top: 1px;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.status-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge {
  padding: 3px 9px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.badge-mode {
  background: rgba(94, 234, 212, .1);
  color: #5eead4;
  border: 1px solid rgba(94, 234, 212, .2);
}

.badge-mode.ramadhan {
  background: rgba(251, 191, 36, .1);
  color: #fbbf24;
  border-color: rgba(251, 191, 36, .2);
}

.badge-mode.pts {
  background: rgba(167, 139, 250, .1);
  color: #a78bfa;
  border-color: rgba(167, 139, 250, .2);
}

.badge-mode.pas {
  background: rgba(251, 113, 133, .1);
  color: #fb7185;
  border-color: rgba(251, 113, 133, .2);
}

.badge-libur {
  background: rgba(248, 113, 113, .1);
  color: #f87171;
  border-color: rgba(248, 113, 113, .2);
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px 4px 9px;
  background: rgba(255, 255, 255, .05);
  border: 1px solid rgba(255, 255, 255, .08);
  border-radius: 20px;
  font-size: 11.5px;
  color: rgba(255, 255, 255, .6);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6b7280;
  flex-shrink: 0;
  transition: background .3s, box-shadow .3s;
}

.dot.on {
  background: #34d399;
  box-shadow: 0 0 0 3px rgba(52, 211, 153, .18);
}

.hbtn {
  padding: 6px 14px;
  border-radius: var(--r);
  border: 1px solid rgba(255, 255, 255, .1);
  background: rgba(255, 255, 255, .06);
  color: rgba(255, 255, 255, .7);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all .15s ease;
  white-space: nowrap;
}

.hbtn:hover {
  background: rgba(255, 255, 255, .12);
  color: #fff;
}

.hbtn-primary {
  background: rgba(94, 234, 212, .12);
  border-color: rgba(94, 234, 212, .2);
  color: #5eead4;
}

.hbtn-primary:hover {
  background: rgba(94, 234, 212, .2);
  color: #2dd4bf;
}

/* NAV */
nav {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  overflow-x: auto;
  padding: 0 24px;
  position: sticky;
  top: var(--header-h);
  z-index: 190;
  scrollbar-width: none;
  height: var(--nav-h);
  align-items: center;
  gap: 2px;
}

nav::-webkit-scrollbar {
  display: none;
}

.nav-btn {
  height: 36px;
  padding: 0 14px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ink-3);
  border-radius: var(--r);
  white-space: nowrap;
  transition: color .15s, background .15s;
  font-family: inherit;
  position: relative;
}

.nav-btn:hover:not(.active) {
  color: var(--ink-2);
  background: var(--bg-2);
}

.nav-btn.active {
  color: var(--brand);
  background: var(--teal-l);
  font-weight: 600;
}

/* MAIN */
main {
  max-width: 980px;
  margin: 0 auto;
  padding: 28px 24px 80px;
}

.section {
  display: none;
}

.section.active {
  display: block;
  animation: fadeUp .25s ease both;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* CARD */
.card {
  background: var(--surface);
  border-radius: var(--r-lg);
  border: 1px solid var(--border);
  box-shadow: var(--sh);
  padding: 24px;
  margin-bottom: 16px;
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.card-title {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -.01em;
}

.card-desc {
  font-size: 12px;
  color: var(--ink-4);
  margin-top: 3px;
  line-height: 1.5;
}

/* SECTION TITLE */
.sec-title {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -.02em;
  margin-bottom: 6px;
}

.sec-desc {
  font-size: 13px;
  color: var(--ink-3);
  margin-bottom: 24px;
}

/* MODE TABS (jadwal) */
.mode-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.mtab {
  padding: 6px 14px;
  border-radius: var(--r);
  border: 1px solid var(--border);
  background: var(--bg);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-3);
  transition: all .15s ease;
  font-family: inherit;
}

.mtab:hover:not(.active) {
  border-color: var(--ink-5);
  color: var(--ink-2);
  background: var(--bg-2);
}

.mtab.active.reguler {
  background: var(--teal);
  color: #fff;
  border-color: var(--teal);
}

.mtab.active.ramadhan {
  background: #d97706;
  color: #fff;
  border-color: #d97706;
}

.mtab.active.pts {
  background: var(--violet);
  color: #fff;
  border-color: var(--violet);
}

.mtab.active.pas {
  background: var(--rose);
  color: #fff;
  border-color: var(--rose);
}

/* HARI TABS */
.hari-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-2);
}

.hari-tab {
  padding: 5px 13px;
  border-radius: var(--r);
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-2);
  transition: all .15s ease;
  font-family: inherit;
}

.hari-tab:hover:not(.active) {
  border-color: var(--teal-b);
  color: var(--teal);
  background: var(--teal-l);
}

.hari-tab.active {
  background: var(--teal);
  color: #fff;
  border-color: var(--teal);
}

/* MODE GRID */
.mode-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

@media (max-width: 560px) {
  .mode-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.mode-opt {
  border: 1.5px solid var(--border);
  border-radius: var(--r-md);
  padding: 18px 14px;
  cursor: pointer;
  text-align: center;
  transition: all .18s ease;
  background: var(--bg);
}

.mode-opt:hover {
  border-color: var(--teal-b);
  background: var(--teal-l);
}

.mode-opt.active {
  border-color: var(--teal);
  background: var(--teal-l);
  box-shadow: 0 0 0 3px rgba(15, 118, 110, .08);
}

.mode-opt.active.ramadhan {
  border-color: #d97706;
  background: var(--amber-l);
  box-shadow: 0 0 0 3px rgba(217, 119, 6, .08);
}

.mode-opt.active.pts {
  border-color: var(--violet);
  background: var(--violet-l);
  box-shadow: 0 0 0 3px rgba(91, 33, 182, .08);
}

.mode-opt.active.pas {
  border-color: var(--rose);
  background: var(--rose-l);
  box-shadow: 0 0 0 3px rgba(159, 18, 57, .08);
}

.mode-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
  margin: 0 auto 10px;
  transition: background .18s;
}

.mode-opt.active .mode-indicator {
  background: var(--teal);
}

.mode-opt.active.ramadhan .mode-indicator {
  background: #d97706;
}

.mode-opt.active.pts .mode-indicator {
  background: var(--violet);
}

.mode-opt.active.pas .mode-indicator {
  background: var(--rose);
}

.mode-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  font-family: 'Plus Jakarta Sans', sans-serif;
  letter-spacing: -.01em;
}

.mode-hint {
  font-size: 11px;
  color: var(--ink-4);
  margin-top: 3px;
  line-height: 1.4;
}

/* TOGGLE ROW */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 0 0;
  border-top: 1px solid var(--border-2);
  gap: 16px;
  margin-top: 6px;
}

.toggle-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.toggle-hint {
  font-size: 11.5px;
  color: var(--ink-4);
  margin-top: 2px;
}

.switch {
  position: relative;
  width: 42px;
  height: 24px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.track {
  position: absolute;
  inset: 0;
  background: var(--ink-5);
  border-radius: 24px;
  cursor: pointer;
  transition: background .25s;
}

.track::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  top: 3px;
  background: #fff;
  border-radius: 50%;
  transition: transform .25s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, .2);
}

input:checked+.track {
  background: var(--teal);
}

input:checked+.track::before {
  transform: translateX(18px);
}

/* FORM */
.row-form {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

@media (max-width: 480px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}

.fg {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fg-grow {
  flex: 1;
  min-width: 140px;
}

label {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: .06em;
}

input[type=text],
input[type=password],
input[type=date],
input[type=time],
select {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--r);
  font-size: 13px;
  color: var(--ink);
  background: var(--surface);
  outline: none;
  font-family: inherit;
  transition: border-color .15s, box-shadow .15s;
  -webkit-appearance: none;
}

input::placeholder {
  color: var(--ink-5);
}

input:focus,
select:focus {
  border-color: var(--teal);
  box-shadow: 0 0 0 3px rgba(15, 118, 110, .1);
}

/* BUTTONS */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--r);
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 600;
  font-family: inherit;
  transition: all .15s ease;
  white-space: nowrap;
  line-height: 1.2;
}

.btn:active {
  transform: scale(.97);
}

.btn.primary {
  background: var(--teal);
  color: #fff;
  border-color: var(--teal);
  box-shadow: 0 1px 3px rgba(15, 118, 110, .3);
}

.btn.primary:hover {
  background: var(--teal-d);
}

.btn.ghost {
  background: var(--surface);
  color: var(--ink-2);
  border-color: var(--border);
}

.btn.ghost:hover {
  background: var(--bg-2);
  border-color: var(--ink-5);
}

.btn.danger {
  background: var(--red-l);
  color: var(--red);
  border-color: var(--red-b);
}

.btn.danger:hover {
  background: var(--red-m);
}

.btn.success {
  background: var(--green-l);
  color: var(--green);
  border-color: var(--green-b);
}

.btn.success:hover {
  background: var(--green-m);
}

.btn.warning {
  background: var(--amber-l);
  color: var(--amber);
  border-color: var(--amber-b);
}

.btn.warning:hover {
  background: var(--amber-m);
}

.btn.sm {
  padding: 5px 11px;
  font-size: 11.5px;
}

.btn-row {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

/* TABLE */
.table-wrap {
  overflow-x: auto;
  border-radius: var(--r);
  border: 1px solid var(--border-2);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th {
  text-align: left;
  padding: 9px 14px;
  background: var(--bg);
  color: var(--ink-3);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  border-bottom: 1px solid var(--border);
}

td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--border-2);
  vertical-align: middle;
  color: var(--ink-2);
}

tr:last-child td {
  border-bottom: none;
}

tbody tr {
  transition: background .1s;
}

tbody tr:hover td {
  background: var(--bg);
}

.t-time {
  font-weight: 700;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  letter-spacing: -.01em;
}

.t-audio {
  color: var(--ink-3);
  font-size: 12px;
}

.t-num {
  color: var(--ink-5);
  font-size: 11px;
  width: 32px;
}

/* NOTICE */
.notice {
  border-radius: var(--r);
  padding: 12px 14px;
  font-size: 12.5px;
  border: 1px solid;
  margin-bottom: 18px;
  line-height: 1.5;
}

.notice.warning {
  background: var(--amber-l);
  border-color: var(--amber-b);
  color: var(--amber-d);
}

.notice.info {
  background: var(--teal-l);
  border-color: var(--teal-b);
  color: var(--teal-d);
}

/* LIBUR LIST */
.libur-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--r);
  margin-bottom: 8px;
  gap: 10px;
  flex-wrap: wrap;
  transition: border-color .15s;
}

.libur-item:last-child {
  margin-bottom: 0;
}

.libur-item.today {
  border-color: #fde68a;
  background: var(--amber-l);
}

.libur-date {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
}

.today-tag {
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 1px 7px;
  background: var(--amber-m);
  color: var(--amber-d);
  border-radius: 4px;
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
}

/* TONE LIST */
.tone-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
  border: 1px solid var(--border);
  border-radius: var(--r);
  margin-bottom: 6px;
  gap: 10px;
  flex-wrap: wrap;
  transition: border-color .15s;
}

.tone-item:hover {
  border-color: var(--ink-5);
}

.tone-item:last-child {
  margin-bottom: 0;
}

.tone-name {
  font-size: 12.5px;
  color: var(--ink-2);
  word-break: break-all;
  font-weight: 500;
}

/* UPLOAD ZONE */
.upload-zone {
  border: 1.5px dashed var(--border);
  border-radius: var(--r-lg);
  padding: 36px 24px;
  text-align: center;
  cursor: pointer;
  background: var(--bg);
  transition: all .2s ease;
}

.upload-zone:hover,
.upload-zone.over {
  border-color: var(--teal);
  background: var(--teal-l);
}

.upload-zone-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 14px;
  transition: all .2s;
}

.upload-zone-icon svg {
  width: 20px;
  height: 20px;
  stroke: var(--ink-4);
  transition: stroke .2s;
}

.upload-zone:hover .upload-zone-icon,
.upload-zone.over .upload-zone-icon {
  background: var(--teal-m);
  border-color: var(--teal-b);
}

.upload-zone:hover .upload-zone-icon svg,
.upload-zone.over .upload-zone-icon svg {
  stroke: var(--teal);
}

.upload-zone p {
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 500;
}

.upload-zone small {
  font-size: 11.5px;
  color: var(--ink-4);
  display: block;
  margin-top: 4px;
}

#fileInput {
  display: none;
}

/* LOG BADGE */
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
  background: var(--teal-l);
  color: var(--teal-d);
}

.log-badge.ramadhan {
  background: var(--amber-l);
  color: var(--amber-d);
}

.log-badge.pts {
  background: var(--violet-l);
  color: var(--violet);
}

.log-badge.pas {
  background: var(--rose-l);
  color: var(--rose);
}

/* COUNT */
.count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  background: var(--bg);
  color: var(--ink-3);
  border-radius: 11px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid var(--border);
}

/* EMPTY */
.empty {
  text-align: center;
  padding: 44px 20px;
  color: var(--ink-4);
  font-size: 13px;
}

/* DIVIDER */
.divider {
  height: 1px;
  background: var(--border-2);
  margin: 18px 0;
}

/* MODAL */
.overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(12, 26, 23, .6);
  z-index: 500;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(6px);
  padding: 20px;
}

.overlay.open {
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
  background: var(--surface);
  border-radius: var(--r-xl);
  padding: 28px;
  width: min(440px, 100%);
  box-shadow: var(--sh-xl);
  border: 1px solid var(--border);
  animation: popIn .2s cubic-bezier(.34, 1.56, .64, 1);
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: scale(.95) translateY(8px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

.modal-head {
  margin-bottom: 22px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-2);
}

.modal-title {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -.01em;
}

.modal-subtitle {
  font-size: 12px;
  color: var(--ink-4);
  margin-top: 3px;
}

.modal-foot {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--border-2);
}

/* TOAST */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  left: 24px;
  max-width: 340px;
  margin: 0 auto;
  background: var(--ink);
  color: #fff;
  padding: 12px 18px;
  border-radius: var(--r-md);
  font-size: 13px;
  font-weight: 500;
  z-index: 600;
  pointer-events: none;
  opacity: 0;
  transform: translateY(10px);
  transition: all .25s ease;
  box-shadow: var(--sh-xl);
  line-height: 1.4;
}

.toast.show {
  opacity: 1;
  transform: translateY(0);
}

.toast.error {
  background: #b91c1c;
}

.toast.success {
  background: #166534;
}

@media (min-width: 480px) {
  .toast {
    left: auto;
  }
}

/* PWA BANNER */
.pwa-banner {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translate(-50%, 140%);
  width: min(420px, calc(100% - 32px));
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
  box-shadow: var(--sh-xl);
  padding: 16px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  z-index: 400;
  transition: transform .4s cubic-bezier(.34, 1.56, .64, 1);
}

.pwa-banner.show {
  transform: translate(-50%, 0);
}

.pwa-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  flex-shrink: 0;
  background: var(--teal-l);
  border: 1px solid var(--teal-m);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pwa-icon svg {
  width: 18px;
  height: 18px;
  stroke: var(--teal);
}

.pwa-text {
  flex: 1;
  min-width: 0;
}

.pwa-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
}

.pwa-desc {
  font-size: 11.5px;
  color: var(--ink-4);
  margin-top: 2px;
}

.pwa-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

/* RESPONSIVE */
@media (max-width: 768px) {
  main {
    padding: 20px 16px 72px;
  }

  header {
    padding: 0 16px;
  }

  .card {
    padding: 18px;
  }
}

@media (max-width: 600px) {
  header {
    height: auto;
    flex-wrap: wrap;
    padding: 12px 16px;
    gap: 10px;
    position: static;
  }

  nav {
    top: 0;
    padding: 0 14px;
  }

  .header-controls {
    width: 100%;
    justify-content: space-between;
  }

  .brand-sub {
    display: none;
  }
}

@media (max-width: 460px) {
  .row-form {
    flex-direction: column;
    align-items: stretch;
  }

  .row-form .btn {
    justify-content: center;
  }

  .modal {
    padding: 20px;
  }

  .status-group .badge {
    display: none;
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
)

func defaultConfig() Config {
	return Config{
		Mode:           "reguler",
		ManualOverride: false,
		RamadhanStart:  "03-01",
		RamadhanEnd:    "03-31",
		PTSStart:       "",
		PTSEnd:         "",
		PASStart:       "",
		PASEnd:         "",
		LiburDates:     []string{},
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
	now := time.Now()
	today := now.Format("2006-01-02")
	md := now.Format("01-02")

	if c.PTSStart != "" && c.PTSEnd != "" {
		if today >= c.PTSStart && today <= c.PTSEnd {
			return "pts"
		}
	}
	if c.PASStart != "" && c.PASEnd != "" {
		if today >= c.PASStart && today <= c.PASEnd {
			return "pas"
		}
	}
	if c.RamadhanStart != "" && c.RamadhanEnd != "" {
		if md >= c.RamadhanStart && md <= c.RamadhanEnd {
			return "ramadhan"
		}
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

func initStorage() error {
	if _, err := os.Stat(configFile); os.IsNotExist(err) {
		if err := saveConfig(defaultConfig()); err != nil {
			return err
		}
	}
	if _, err := os.Stat(jadwalFile); os.IsNotExist(err) {
		return saveJadwal(defaultJadwal())
	}
	return nil
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
	return j, nil
}

func saveJadwal(j ModeJadwal) error {
	jadwalMu.Lock()
	defer jadwalMu.Unlock()

	data, err := json.MarshalIndent(j, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(jadwalFile, data, 0644)
}

func listTones() ([]string, error) {
	entries, err := os.ReadDir(toneDir)
	if err != nil {
		return nil, err
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() {
			ext := filepath.Ext(e.Name())
			if ext == ".mp3" || ext == ".wav" || ext == ".ogg" {
				files = append(files, e.Name())
			}
		}
	}
	sort.Strings(files)
	return files, nil
}

func writeLog(entry ActivityLog) {
	logMu.Lock()
	defer logMu.Unlock()

	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()

	line, _ := json.Marshal(entry)
	f.Write(append(line, '\n'))
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

	var logs []ActivityLog
	for _, line := range splitLines(data) {
		if len(line) == 0 {
			continue
		}
		var l ActivityLog
		if json.Unmarshal(line, &l) == nil {
			logs = append(logs, l)
		}
	}

	if len(logs) > maxLogLines {
		logs = logs[len(logs)-maxLogLines:]
	}
	reverse(logs)
	return logs, nil
}

func splitLines(data []byte) [][]byte {
	var lines [][]byte
	start := 0
	for i, b := range data {
		if b == '\n' {
			lines = append(lines, data[start:i])
			start = i + 1
		}
	}
	if start < len(data) {
		lines = append(lines, data[start:])
	}
	return lines
}

func reverse(logs []ActivityLog) {
	for i, j := 0, len(logs)-1; i < j; i, j = i+1, j-1 {
		logs[i], logs[j] = logs[j], logs[i]
	}
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
			"Senin": {
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
				{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
				{Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"},
				{Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"},
				{Waktu: "10:31", Audio: b + "/tanah-airku.mp3"},
			},
			"Selasa": {
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
				{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
				{Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"},
				{Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"},
				{Waktu: "10:31", Audio: b + "/tanah-airku.mp3"},
			},
			"Rabu": {
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
				{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
				{Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"},
				{Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"},
				{Waktu: "10:31", Audio: b + "/tanah-airku.mp3"},
			},
			"Kamis": {
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
				{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
				{Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"},
				{Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"},
				{Waktu: "10:31", Audio: b + "/tanah-airku.mp3"},
			},
			"Jumat": {
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
				{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
				{Waktu: "09:30", Audio: b + "/pelajaran-selesai.mp3"},
				{Waktu: "09:31", Audio: b + "/tanah-airku.mp3"},
			},
		},
		"pas": {
			"Senin": {
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
				{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
				{Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"},
				{Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"},
				{Waktu: "10:31", Audio: b + "/tanah-airku.mp3"},
			},
			"Selasa": {
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
				{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
				{Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"},
				{Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"},
				{Waktu: "10:31", Audio: b + "/tanah-airku.mp3"},
			},
			"Rabu": {
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
				{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
				{Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"},
				{Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"},
				{Waktu: "10:31", Audio: b + "/tanah-airku.mp3"},
			},
			"Kamis": {
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
				{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
				{Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"},
				{Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"},
				{Waktu: "10:31", Audio: b + "/tanah-airku.mp3"},
			},
			"Jumat": {
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
				{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
				{Waktu: "09:30", Audio: b + "/pelajaran-selesai.mp3"},
				{Waktu: "09:31", Audio: b + "/tanah-airku.mp3"},
			},
		},
	}
}

```
---
