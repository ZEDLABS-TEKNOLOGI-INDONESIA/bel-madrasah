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
	// Static files
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

	// Auth
	mux.HandleFunc("/login", handleLogin)
	mux.HandleFunc("/logout", handleLogout)

	// Pages
	mux.HandleFunc("/", requireAuth(handleIndex))

	// API - Jadwal
	mux.HandleFunc("/api/jadwal", requireAuth(handleJadwal))
	mux.HandleFunc("/api/jadwal/hari", requireAuth(handleJadwalHari))
	mux.HandleFunc("/api/jadwal/entry", requireAuth(handleJadwalEntry))

	// API - Tone
	mux.HandleFunc("/api/tones", requireAuth(handleTones))
	mux.HandleFunc("/api/tones/upload", requireAuth(handleTonesUpload))
	mux.HandleFunc("/api/tones/delete", requireAuth(handleTonesDelete))
	mux.HandleFunc("/api/tones/preview", requireAuth(handleTonesPreview))

	// API - Service
	mux.HandleFunc("/api/service/status", requireAuth(handleServiceStatus))
	mux.HandleFunc("/api/service/toggle", requireAuth(handleServiceToggle))

	// API - Auth
	mux.HandleFunc("/api/change-password", requireAuth(handleChangePassword))
}

// ─── AUTH ────────────────────────────────────────────────────────────────────

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

// ─── PAGES ───────────────────────────────────────────────────────────────────

func handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, filepath.Join(staticDir, "index.html"))
}

// ─── JADWAL ──────────────────────────────────────────────────────────────────

func handleJadwal(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		j, err := loadJadwal()
		if err != nil {
			jsonError(w, "Gagal memuat jadwal", http.StatusInternalServerError)
			return
		}
		// Return sorted day keys
		days := make([]string, 0, len(j))
		for d := range j {
			days = append(days, d)
		}
		sort.Strings(days)
		jsonOK(w, map[string]any{"jadwal": j, "hari": days})

	default:
		http.NotFound(w, r)
	}
}

// POST /api/jadwal/hari - tambah atau hapus hari
func handleJadwalHari(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	var body struct {
		Action string `json:"action"` // "add" | "delete"
		Hari   string `json:"hari"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "Request tidak valid", http.StatusBadRequest)
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
	switch body.Action {
	case "add":
		if _, exists := j[body.Hari]; exists {
			jsonError(w, fmt.Sprintf("Hari %s sudah ada", body.Hari), http.StatusBadRequest)
			return
		}
		j[body.Hari] = []Entry{}
	case "delete":
		delete(j, body.Hari)
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

// POST /api/jadwal/entry - tambah, edit, hapus entry dalam satu hari
func handleJadwalEntry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.NotFound(w, r)
		return
	}
	var body struct {
		Action string `json:"action"` // "add" | "edit" | "delete"
		Hari   string `json:"hari"`
		Index  int    `json:"index"`
		Entry  Entry  `json:"entry"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "Request tidak valid", http.StatusBadRequest)
		return
	}
	j, err := loadJadwal()
	if err != nil {
		jsonError(w, "Gagal memuat jadwal", http.StatusInternalServerError)
		return
	}
	entries, ok := j[body.Hari]
	if !ok {
		jsonError(w, fmt.Sprintf("Hari %s tidak ditemukan", body.Hari), http.StatusNotFound)
		return
	}
	switch body.Action {
	case "add":
		entries = append(entries, body.Entry)
		sort.Slice(entries, func(i, k int) bool {
			return entries[i].Waktu < entries[k].Waktu
		})
	case "edit":
		if body.Index < 0 || body.Index >= len(entries) {
			jsonError(w, "Index tidak valid", http.StatusBadRequest)
			return
		}
		entries[body.Index] = body.Entry
		sort.Slice(entries, func(i, k int) bool {
			return entries[i].Waktu < entries[k].Waktu
		})
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
	j[body.Hari] = entries
	if err := saveJadwal(j); err != nil {
		jsonError(w, "Gagal menyimpan jadwal", http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{"message": "Berhasil"})
}

// ─── TONES ───────────────────────────────────────────────────────────────────

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
		jsonError(w, "Format file tidak didukung. Gunakan mp3, wav, atau ogg.", http.StatusBadRequest)
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

// ─── SERVICE ─────────────────────────────────────────────────────────────────

func handleServiceStatus(w http.ResponseWriter, r *http.Request) {
	schedulerMu.Lock()
	running := schedulerRunning
	schedulerMu.Unlock()
	jsonOK(w, map[string]bool{"running": running})
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
    mkdir -p "$PROJECT_DIR/static"
    success "Direktori proyek: $PROJECT_DIR"
}

build_binary() {
    info "Membangun binary Go..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # Validasi file Go yang diperlukan (jadwal.go sudah dihapus/digabung ke storage.go)
    for f in main.go auth.go handler.go storage.go go.mod; do
        if [ ! -f "$SCRIPT_DIR/$f" ]; then
            error "$f tidak ditemukan di direktori installer ($SCRIPT_DIR)."
            exit 1
        fi
    done

    # Hapus jadwal.go jika masih ada (menyebabkan compile error)
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

copy_static() {
    info "Menyalin file static..."
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [ -d "$SCRIPT_DIR/static" ]; then
        cp -r "$SCRIPT_DIR/static/." "$PROJECT_DIR/static/"
        success "File static disalin ke $PROJECT_DIR/static/"
    else
        warning "Direktori static tidak ditemukan, dilewati."
    fi
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
        # Lewati jika sudah ada di direktori lokal
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
    chmod 755 "$PROJECT_DIR/bel-madrasah"
    chmod 644 "$PROJECT_DIR/tone/"*.mp3 2>/dev/null || true
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
    # Dapatkan IP lokal
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
	return hariMap[time.Now().Weekday()] // returns "" for weekend
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

		if hari != "" {
			jadwal, err := loadJadwal()
			if err == nil {
				if jadwalHari, ok := jadwal[hari]; ok {
					waktuSekarang := now.Format("15:04")
					for _, entry := range jadwalHari {
						key := hari + "-" + entry.Waktu
						if waktuSekarang == entry.Waktu && !sudahDiputar[key] {
							logMsg(fmt.Sprintf("Memutar: %s [%s]", filepath.Base(entry.Audio), entry.Waktu))
							playSound(entry.Audio)
							sudahDiputar[key] = true
						}
					}
				}
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

## static/index.html
```html
<!DOCTYPE html>
<html lang="id">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bel Madrasah - MTsN 1 Pandeglang</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0
    }

    body {
      font-family: 'Segoe UI', sans-serif;
      background: #f0f4f8;
      color: #1a202c;
      min-height: 100vh
    }

    header {
      background: #1a56db;
      color: #fff;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 8px #0003
    }

    header h1 {
      font-size: 1.1rem;
      font-weight: 700
    }

    header small {
      font-size: .75rem;
      opacity: .8;
      display: block
    }

    .status-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: .85rem
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #f87171
    }

    .dot.on {
      background: #34d399
    }

    .toggle-btn {
      background: #fff2;
      border: 1px solid #fff4;
      color: #fff;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: .82rem;
      transition: background .2s
    }

    .toggle-btn:hover {
      background: #fff3
    }

    nav {
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      gap: 0;
      overflow-x: auto
    }

    nav button {
      padding: 12px 20px;
      border: none;
      background: none;
      cursor: pointer;
      font-size: .9rem;
      color: #64748b;
      border-bottom: 3px solid transparent;
      white-space: nowrap;
      transition: all .2s
    }

    nav button.active {
      color: #1a56db;
      border-bottom-color: #1a56db;
      font-weight: 600
    }

    nav button:hover:not(.active) {
      background: #f8fafc;
      color: #1a56db
    }

    main {
      max-width: 960px;
      margin: 24px auto;
      padding: 0 16px
    }

    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 4px #0001;
      padding: 20px;
      margin-bottom: 20px
    }

    .card h2 {
      font-size: 1rem;
      font-weight: 700;
      color: #1a202c;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px
    }

    .section {
      display: none
    }

    .section.active {
      display: block
    }

    /* Jadwal */
    .hari-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px
    }

    .hari-tab {
      padding: 7px 16px;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      cursor: pointer;
      font-size: .85rem;
      color: #475569;
      transition: all .15s
    }

    .hari-tab.active {
      background: #1a56db;
      color: #fff;
      border-color: #1a56db
    }

    .hari-tab:hover:not(.active) {
      background: #e0eaff;
      border-color: #93c5fd
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: .88rem
    }

    th {
      text-align: left;
      padding: 10px 12px;
      background: #f8fafc;
      color: #64748b;
      font-weight: 600;
      border-bottom: 2px solid #e2e8f0
    }

    td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle
    }

    tr:last-child td {
      border-bottom: none
    }

    tr:hover td {
      background: #fafbff
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 13px;
      border-radius: 7px;
      border: none;
      cursor: pointer;
      font-size: .82rem;
      font-weight: 500;
      transition: all .15s
    }

    .btn-primary {
      background: #1a56db;
      color: #fff
    }

    .btn-primary:hover {
      background: #1e40af
    }

    .btn-danger {
      background: #fee2e2;
      color: #dc2626
    }

    .btn-danger:hover {
      background: #fecaca
    }

    .btn-success {
      background: #dcfce7;
      color: #16a34a
    }

    .btn-success:hover {
      background: #bbf7d0
    }

    .btn-ghost {
      background: #f1f5f9;
      color: #475569
    }

    .btn-ghost:hover {
      background: #e2e8f0
    }

    .btn-sm {
      padding: 4px 10px;
      font-size: .78rem
    }

    .row-actions {
      display: flex;
      gap: 6px
    }

    .add-hari {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap
    }

    .add-hari input {
      flex: 1;
      min-width: 140px;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      font-size: .88rem;
      outline: none
    }

    .add-hari input:focus {
      border-color: #1a56db
    }

    /* Modal */
    .overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: #0006;
      z-index: 100;
      align-items: center;
      justify-content: center
    }

    .overlay.open {
      display: flex
    }

    .modal {
      background: #fff;
      border-radius: 14px;
      padding: 24px;
      width: min(420px, 92vw);
      box-shadow: 0 8px 32px #0003
    }

    .modal h3 {
      font-size: 1rem;
      font-weight: 700;
      margin-bottom: 18px
    }

    .form-group {
      margin-bottom: 14px
    }

    label {
      display: block;
      font-size: .83rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 5px
    }

    input[type=time],
    select,
    input[type=text],
    input[type=password] {
      width: 100%;
      padding: 9px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      font-size: .9rem;
      outline: none;
      transition: border .15s
    }

    input[type=time]:focus,
    select:focus,
    input[type=text]:focus,
    input[type=password]:focus {
      border-color: #1a56db
    }

    .modal-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 18px
    }

    /* Tones */
    .tone-grid {
      display: grid;
      gap: 10px
    }

    .tone-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 9px;
      background: #fafafa;
      transition: background .15s
    }

    .tone-item:hover {
      background: #f0f6ff
    }

    .tone-name {
      font-size: .88rem;
      font-weight: 500;
      color: #1a202c;
      word-break: break-all
    }

    .tone-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0
    }

    .upload-area {
      border: 2px dashed #93c5fd;
      border-radius: 10px;
      padding: 28px;
      text-align: center;
      cursor: pointer;
      transition: all .2s;
      margin-bottom: 16px
    }

    .upload-area:hover,
    .upload-area.drag {
      background: #eff6ff;
      border-color: #3b82f6
    }

    .upload-area p {
      color: #64748b;
      font-size: .88rem;
      margin-top: 6px
    }

    #fileInput {
      display: none
    }

    /* Settings */
    .setting-item {
      margin-bottom: 16px
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1a202c;
      color: #fff;
      padding: 12px 20px;
      border-radius: 9px;
      font-size: .88rem;
      z-index: 200;
      opacity: 0;
      transform: translateY(8px);
      transition: all .25s;
      pointer-events: none
    }

    .toast.show {
      opacity: 1;
      transform: translateY(0)
    }

    .toast.error {
      background: #dc2626
    }

    .toast.success {
      background: #16a34a
    }

    /* empty state */
    .empty {
      text-align: center;
      padding: 32px;
      color: #94a3b8;
      font-size: .9rem
    }
  </style>
</head>

<body>

  <header>
    <div>
      <h1>Bel Madrasah Otomatis</h1>
      <small>MTsN 1 Pandeglang</small>
    </div>
    <div style="display:flex;align-items:center;gap:12px">
      <div class="status-badge">
        <div class="dot" id="statusDot"></div>
        <span id="statusText">Memuat...</span>
      </div>
      <button class="toggle-btn" id="toggleBtn" onclick="toggleService()">--</button>
      <button class="toggle-btn" onclick="logout()">Keluar</button>
    </div>
  </header>

  <nav>
    <button class="active" onclick="switchTab('jadwal',this)">Jadwal</button>
    <button onclick="switchTab('tones',this)">Audio</button>
    <button onclick="switchTab('settings',this)">Pengaturan</button>
  </nav>

  <main>

    <!-- JADWAL -->
    <div class="section active" id="sec-jadwal">
      <div class="card">
        <h2>Kelola Hari</h2>
        <div class="add-hari">
          <input type="text" id="newHariInput" placeholder="Nama hari baru (mis: Sabtu)">
          <button class="btn btn-primary" onclick="addHari()">+ Tambah Hari</button>
        </div>
        <div class="hari-tabs" id="hariTabs"></div>
      </div>
      <div class="card">
        <h2 id="jadwalTitle">Pilih hari di atas</h2>
        <div
          style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <span id="hariInfo" style="font-size:.83rem;color:#64748b"></span>
          <div style="display:flex;gap:8px">
            <button class="btn btn-danger btn-sm" id="deleteHariBtn" onclick="deleteHari()" style="display:none">Hapus
              Hari Ini</button>
            <button class="btn btn-primary btn-sm" id="addEntryBtn" onclick="openAddEntry()" style="display:none">+
              Tambah Bel</button>
          </div>
        </div>
        <div id="jadwalTable">
          <div class="empty">Pilih hari untuk melihat jadwal</div>
        </div>
      </div>
    </div>

    <!-- TONES -->
    <div class="section" id="sec-tones">
      <div class="card">
        <h2>Upload Audio</h2>
        <div class="upload-area" id="uploadArea" onclick="document.getElementById('fileInput').click()"
          ondragover="e=event;e.preventDefault();this.classList.add('drag')" ondragleave="this.classList.remove('drag')"
          ondrop="handleDrop(event)">
          <svg width="36" height="36" fill="none" stroke="#93c5fd" stroke-width="1.5" viewBox="0 0 24 24">
            <path d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16" />
          </svg>
          <p>Klik atau seret file audio ke sini<br><small>Format: mp3, wav, ogg — Maks 32MB</small></p>
        </div>
        <input type="file" id="fileInput" accept=".mp3,.wav,.ogg" onchange="uploadFile(this.files[0])">
      </div>
      <div class="card">
        <h2>Daftar Audio <span id="toneCount" style="font-weight:400;font-size:.85rem;color:#64748b"></span></h2>
        <div class="tone-grid" id="toneList">
          <div class="empty">Memuat...</div>
        </div>
      </div>
    </div>

    <!-- SETTINGS -->
    <div class="section" id="sec-settings">
      <div class="card">
        <h2>Ganti Password</h2>
        <div class="setting-item">
          <label>Password Lama</label>
          <input type="password" id="oldPass" placeholder="••••••••">
        </div>
        <div class="setting-item">
          <label>Password Baru</label>
          <input type="password" id="newPass" placeholder="Minimal 6 karakter">
        </div>
        <div class="setting-item">
          <label>Konfirmasi Password Baru</label>
          <input type="password" id="confirmPass" placeholder="Ulangi password baru">
        </div>
        <button class="btn btn-primary" onclick="changePassword()">Simpan Password</button>
      </div>
    </div>

  </main>

  <!-- Modal Entry -->
  <div class="overlay" id="entryModal">
    <div class="modal">
      <h3 id="modalTitle">Tambah Bel</h3>
      <div class="form-group">
        <label>Waktu</label>
        <input type="time" id="entryWaktu">
      </div>
      <div class="form-group">
        <label>File Audio</label>
        <select id="entryAudio"></select>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" id="modalSaveBtn" onclick="saveEntry()">Simpan</button>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    let currentHari = null;
    let editIndex = -1;
    let allTones = [];
    let jadwalData = {};

    // ── UTILS ──
    function toast(msg, type = 'success') {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.className = `toast show ${type}`;
      setTimeout(() => el.className = 'toast', 2800);
    }

    async function api(url, method = 'GET', body = null) {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(url, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
      return data;
    }

    function switchTab(id, btn) {
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
      document.getElementById('sec-' + id).classList.add('active');
      btn.classList.add('active');
      if (id === 'tones') loadTones();
    }

    function logout() {
      window.location.href = '/logout';
    }

    // ── SERVICE ──
    async function loadStatus() {
      try {
        const d = await api('/api/service/status');
        const dot = document.getElementById('statusDot');
        const txt = document.getElementById('statusText');
        const btn = document.getElementById('toggleBtn');
        dot.className = 'dot' + (d.running ? ' on' : '');
        txt.textContent = d.running ? 'Aktif' : 'Nonaktif';
        btn.textContent = d.running ? 'Hentikan' : 'Aktifkan';
      } catch (e) { }
    }

    async function toggleService() {
      try {
        const d = await api('/api/service/toggle', 'POST');
        toast(d.message);
        loadStatus();
      } catch (e) { toast(e.message, 'error'); }
    }

    // ── JADWAL ──
    async function loadJadwal() {
      try {
        const d = await api('/api/jadwal');
        jadwalData = d.jadwal || {};
        renderHariTabs(Object.keys(jadwalData));
        if (currentHari && jadwalData[currentHari]) {
          renderJadwalTable(currentHari);
        } else {
          currentHari = null;
          document.getElementById('jadwalTitle').textContent = 'Pilih hari di atas';
          document.getElementById('jadwalTable').innerHTML = '<div class="empty">Pilih hari untuk melihat jadwal</div>';
          document.getElementById('addEntryBtn').style.display = 'none';
          document.getElementById('deleteHariBtn').style.display = 'none';
        }
      } catch (e) { toast(e.message, 'error'); }
    }

    function renderHariTabs(days) {
      const container = document.getElementById('hariTabs');
      container.innerHTML = '';
      if (!days.length) {
        container.innerHTML = '<span style="color:#94a3b8;font-size:.85rem">Belum ada hari. Tambahkan di atas.</span>';
        return;
      }
      days.forEach(h => {
        const btn = document.createElement('button');
        btn.className = 'hari-tab' + (h === currentHari ? ' active' : '');
        btn.textContent = h;
        btn.onclick = () => selectHari(h);
        container.appendChild(btn);
      });
    }

    function selectHari(hari) {
      currentHari = hari;
      document.querySelectorAll('.hari-tab').forEach(b => b.classList.toggle('active', b.textContent === hari));
      renderJadwalTable(hari);
      document.getElementById('addEntryBtn').style.display = '';
      document.getElementById('deleteHariBtn').style.display = '';
    }

    function renderJadwalTable(hari) {
      document.getElementById('jadwalTitle').textContent = 'Jadwal ' + hari;
      const entries = jadwalData[hari] || [];
      document.getElementById('hariInfo').textContent = entries.length + ' entri';
      if (!entries.length) {
        document.getElementById('jadwalTable').innerHTML = '<div class="empty">Belum ada jadwal untuk hari ini</div>';
        return;
      }
      let html = '<table><thead><tr><th>#</th><th>Waktu</th><th>File Audio</th><th>Aksi</th></tr></thead><tbody>';
      entries.forEach((e, i) => {
        const fname = e.audio.split('/').pop();
        html += `<tr>
      <td style="color:#94a3b8">${i + 1}</td>
      <td><strong>${e.waktu}</strong></td>
      <td>${fname}</td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-sm" onclick="openEditEntry(${i})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteEntry(${i})">Hapus</button>
      </div></td>
    </tr>`;
      });
      html += '</tbody></table>';
      document.getElementById('jadwalTable').innerHTML = html;
    }

    async function addHari() {
      const input = document.getElementById('newHariInput');
      const hari = input.value.trim();
      if (!hari) { toast('Nama hari tidak boleh kosong', 'error'); return; }
      try {
        await api('/api/jadwal/hari', 'POST', { action: 'add', hari });
        toast('Hari ' + hari + ' ditambahkan');
        input.value = '';
        await loadJadwal();
        selectHari(hari);
      } catch (e) { toast(e.message, 'error'); }
    }

    async function deleteHari() {
      if (!currentHari) return;
      if (!confirm(`Hapus hari ${currentHari} beserta seluruh jadwalnya?`)) return;
      try {
        await api('/api/jadwal/hari', 'POST', { action: 'delete', hari: currentHari });
        toast('Hari ' + currentHari + ' dihapus');
        currentHari = null;
        await loadJadwal();
      } catch (e) { toast(e.message, 'error'); }
    }

    function openAddEntry() {
      editIndex = -1;
      document.getElementById('modalTitle').textContent = 'Tambah Bel - ' + currentHari;
      document.getElementById('entryWaktu').value = '';
      populateAudioSelect('');
      document.getElementById('entryModal').classList.add('open');
    }

    function openEditEntry(idx) {
      editIndex = idx;
      const entry = jadwalData[currentHari][idx];
      document.getElementById('modalTitle').textContent = 'Edit Bel - ' + currentHari;
      document.getElementById('entryWaktu').value = entry.waktu;
      populateAudioSelect(entry.audio);
      document.getElementById('entryModal').classList.add('open');
    }

    function populateAudioSelect(current) {
      const sel = document.getElementById('entryAudio');
      sel.innerHTML = allTones.map(t => {
        const fullPath = '/opt/bel-madrasah/tone/' + t;
        return `<option value="${fullPath}" ${current === fullPath ? 'selected' : ''}>${t}</option>`;
      }).join('');
    }

    function closeModal() {
      document.getElementById('entryModal').classList.remove('open');
    }

    async function saveEntry() {
      const waktu = document.getElementById('entryWaktu').value;
      const audio = document.getElementById('entryAudio').value;
      if (!waktu) { toast('Waktu harus diisi', 'error'); return; }
      if (!audio) { toast('Pilih file audio', 'error'); return; }
      const action = editIndex === -1 ? 'add' : 'edit';
      try {
        await api('/api/jadwal/entry', 'POST', { action, hari: currentHari, index: editIndex, entry: { waktu, audio } });
        toast(action === 'add' ? 'Bel ditambahkan' : 'Bel diperbarui');
        closeModal();
        await loadJadwal();
      } catch (e) { toast(e.message, 'error'); }
    }

    async function deleteEntry(idx) {
      if (!confirm('Hapus entri ini?')) return;
      try {
        await api('/api/jadwal/entry', 'POST', { action: 'delete', hari: currentHari, index: idx, entry: {} });
        toast('Entri dihapus');
        await loadJadwal();
      } catch (e) { toast(e.message, 'error'); }
    }

    // ── TONES ──
    async function loadTones() {
      try {
        const d = await api('/api/tones');
        allTones = d.tones || [];
        const count = document.getElementById('toneCount');
        count.textContent = `(${allTones.length} file)`;
        const list = document.getElementById('toneList');
        if (!allTones.length) {
          list.innerHTML = '<div class="empty">Belum ada file audio</div>';
          return;
        }
        list.innerHTML = allTones.map(f => `
      <div class="tone-item">
        <span class="tone-name">${f}</span>
        <div class="tone-actions">
          <button class="btn btn-success btn-sm" onclick="previewTone('${f}')">▶ Test</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTone('${f}')">Hapus</button>
        </div>
      </div>`).join('');
      } catch (e) { toast(e.message, 'error'); }
    }

    async function uploadFile(file) {
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      try {
        toast('Mengupload ' + file.name + '...');
        const res = await fetch('/api/tones/upload', { method: 'POST', body: fd });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        toast(d.message);
        document.getElementById('fileInput').value = '';
        loadTones();
      } catch (e) { toast(e.message, 'error'); }
    }

    function handleDrop(e) {
      e.preventDefault();
      document.getElementById('uploadArea').classList.remove('drag');
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    }

    async function previewTone(filename) {
      try {
        await api('/api/tones/preview', 'POST', { filename });
        toast('Memutar ' + filename);
      } catch (e) { toast(e.message, 'error'); }
    }

    async function deleteTone(filename) {
      if (!confirm(`Hapus file ${filename}?`)) return;
      try {
        await api('/api/tones/delete', 'POST', { filename });
        toast(filename + ' dihapus');
        loadTones();
      } catch (e) { toast(e.message, 'error'); }
    }

    // ── SETTINGS ──
    async function changePassword() {
      const old = document.getElementById('oldPass').value;
      const nw = document.getElementById('newPass').value;
      const cf = document.getElementById('confirmPass').value;
      if (nw !== cf) { toast('Konfirmasi password tidak cocok', 'error'); return; }
      if (nw.length < 6) { toast('Password baru minimal 6 karakter', 'error'); return; }
      try {
        const d = await api('/api/change-password', 'POST', { old_password: old, new_password: nw });
        toast(d.message);
        ['oldPass', 'newPass', 'confirmPass'].forEach(id => document.getElementById(id).value = '');
      } catch (e) { toast(e.message, 'error'); }
    }

    // ── INIT ──
    window.addEventListener('click', e => {
      if (e.target === document.getElementById('entryModal')) closeModal();
    });

    (async () => {
      await Promise.all([loadStatus(), loadJadwal(), loadTones()]);
      setInterval(loadStatus, 10000);
    })();
  </script>
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Bel Madrasah</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0
    }

    body {
      font-family: 'Segoe UI', sans-serif;
      background: #f0f4f8;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center
    }

    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 24px #0002;
      padding: 36px 32px;
      width: min(380px, 92vw)
    }

    .logo {
      text-align: center;
      margin-bottom: 28px
    }

    .logo svg {
      display: block;
      margin: 0 auto 12px
    }

    .logo h1 {
      font-size: 1.2rem;
      font-weight: 700;
      color: #1a202c
    }

    .logo p {
      font-size: .83rem;
      color: #64748b;
      margin-top: 3px
    }

    .form-group {
      margin-bottom: 16px
    }

    label {
      display: block;
      font-size: .83rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px
    }

    input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: .92rem;
      outline: none;
      transition: border .15s
    }

    input:focus {
      border-color: #1a56db;
      box-shadow: 0 0 0 3px #1a56db18
    }

    .btn {
      width: 100%;
      padding: 11px;
      background: #1a56db;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: .95rem;
      font-weight: 600;
      cursor: pointer;
      transition: background .2s;
      margin-top: 6px
    }

    .btn:hover {
      background: #1e40af
    }

    .btn:disabled {
      background: #93c5fd;
      cursor: not-allowed
    }

    .error {
      background: #fee2e2;
      color: #dc2626;
      border-radius: 7px;
      padding: 10px 14px;
      font-size: .85rem;
      margin-bottom: 14px;
      display: none
    }
  </style>
</head>

<body>
  <div class="card">
    <div class="logo">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1a56db" stroke-width="1.5">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      <h1>Bel Madrasah</h1>
      <p>MTsN 1 Pandeglang</p>
    </div>
    <div class="error" id="errorMsg"></div>
    <div class="form-group">
      <label>Username</label>
      <input type="text" id="username" placeholder="admin" autocomplete="username">
    </div>
    <div class="form-group">
      <label>Password</label>
      <input type="password" id="password" placeholder="••••••••" autocomplete="current-password"
        onkeydown="if(event.key==='Enter')login()">
    </div>
    <button class="btn" id="loginBtn" onclick="login()">Masuk</button>
  </div>
  <script>
    async function login() {
      const btn = document.getElementById('loginBtn');
      const err = document.getElementById('errorMsg');
      const u = document.getElementById('username').value.trim();
      const p = document.getElementById('password').value;
      if (!u || !p) { showError('Username dan password harus diisi'); return; }
      btn.disabled = true;
      btn.textContent = 'Masuk...';
      err.style.display = 'none';
      try {
        const res = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p })
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        window.location.href = '/';
      } catch (e) {
        showError(e.message);
        btn.disabled = false;
        btn.textContent = 'Masuk';
      }
    }
    function showError(msg) {
      const el = document.getElementById('errorMsg');
      el.textContent = msg;
      el.style.display = 'block';
    }
  </script>
</body>

</html>

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
)

const jadwalFile = dataDir + "/jadwal.json"

type Entry struct {
	Waktu string `json:"waktu"`
	Audio string `json:"audio"`
}

type Jadwal map[string][]Entry

var jadwalMu sync.RWMutex

func initStorage() error {
	if _, err := os.Stat(jadwalFile); os.IsNotExist(err) {
		return saveJadwal(defaultJadwal())
	}
	return nil
}

func loadJadwal() (Jadwal, error) {
	jadwalMu.RLock()
	defer jadwalMu.RUnlock()

	data, err := os.ReadFile(jadwalFile)
	if err != nil {
		return nil, err
	}
	var j Jadwal
	if err := json.Unmarshal(data, &j); err != nil {
		return nil, err
	}
	return j, nil
}

func saveJadwal(j Jadwal) error {
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

func defaultJadwal() Jadwal {
	b := toneDir
	return Jadwal{
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
	}
}

```
---
