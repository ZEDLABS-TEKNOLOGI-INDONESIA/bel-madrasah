package main

import (
	"encoding/json"
	"fmt"
	"net/http"
)

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
		body.Equalizer = existing.Equalizer
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

func handleEqualizer(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		cfg, err := loadConfig()
		if err != nil {
			jsonError(w, "gagal memuat config", http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]any{
			"enabled":     cfg.Equalizer.Enabled,
			"gains":       cfg.Equalizer.Gains,
			"frequencies": eqFrequencies,
			"min_gain":    eqMinGain,
			"max_gain":    eqMaxGain,
			"peak_q":      eqPeakQ,
		})

	case http.MethodPost:
		var body Equalizer
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonError(w, "request tidak valid", http.StatusBadRequest)
			return
		}
		if err := validateEqualizer(body); err != nil {
			jsonError(w, err.Error(), http.StatusBadRequest)
			return
		}
		cfg, err := loadConfig()
		if err != nil {
			jsonError(w, "gagal memuat config", http.StatusInternalServerError)
			return
		}
		cfg.Equalizer = normalizeEqualizer(body)
		if err := saveConfig(cfg); err != nil {
			jsonError(w, "gagal menyimpan equalizer", http.StatusInternalServerError)
			return
		}
		logMsg(fmt.Sprintf("equalizer diperbarui: aktif=%v gain=%v", cfg.Equalizer.Enabled, cfg.Equalizer.Gains))
		jsonOK(w, map[string]string{"message": "equalizer berhasil disimpan"})

	default:
		methodNotAllowed(w)
	}
}
