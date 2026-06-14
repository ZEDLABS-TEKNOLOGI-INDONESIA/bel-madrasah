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
