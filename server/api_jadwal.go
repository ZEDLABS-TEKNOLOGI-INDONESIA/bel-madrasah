package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

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
		if strings.TrimSpace(body.Entry.Audio) == "" {
			jsonError(w, "audio tidak boleh kosong", http.StatusBadRequest)
			return
		}
		audio, ok := resolveAudioPath(body.Entry.Audio)
		if !ok {
			jsonError(w, "path audio tidak valid", http.StatusBadRequest)
			return
		}
		body.Entry.Audio = audio
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

func handleJadwalReset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		Mode string `json:"mode"`
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
	j[body.Mode] = defaultJadwal()[body.Mode]
	if err := saveJadwal(j); err != nil {
		jsonError(w, "gagal menyimpan jadwal", http.StatusInternalServerError)
		return
	}
	logMsg("jadwal mode " + body.Mode + " direset ke default")
	jsonOK(w, map[string]string{"message": "jadwal direset ke default"})
}
