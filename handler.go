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
		go setLiveVolume(body.Volume)
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
