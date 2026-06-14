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
	validModes := map[string]bool{"reguler": true, "ramadhan": true, "pts": true, "pas": true}
	if mode == "" || !validModes[mode] {
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
	j, err := loadJadwal()
	if err != nil {
		jsonError(w, "Gagal memuat jadwal", http.StatusInternalServerError)
		return
	}
	data, err := json.MarshalIndent(j, "", "  ")
	if err != nil {
		jsonError(w, "Gagal membuat backup", http.StatusInternalServerError)
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

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		jsonError(w, "File tidak valid (bukan JSON yang benar)", http.StatusBadRequest)
		return
	}

	validModes := map[string]bool{"reguler": true, "ramadhan": true, "pts": true, "pas": true}
	j := make(ModeJadwal)

	for mode, rawMode := range raw {
		if !validModes[mode] {
			continue
		}
		var hariMap map[string][]Entry
		if err := json.Unmarshal(rawMode, &hariMap); err != nil {
			jsonError(w, fmt.Sprintf("Format mode %s tidak valid", mode), http.StatusBadRequest)
			return
		}
		j[mode] = hariMap
	}

	for _, mode := range []string{"reguler", "ramadhan", "pts", "pas"} {
		if j[mode] == nil {
			j[mode] = map[string][]Entry{}
		}
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
