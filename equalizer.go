package main

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
)

const (
	eqMinGain = -12.0
	eqMaxGain = 12.0
)

var eqFrequencies = []int{60, 250, 1000, 4000, 12000}

type Equalizer struct {
	Enabled bool      `json:"enabled"`
	Gains   []float64 `json:"gains"`
}

func defaultEqualizer() Equalizer {
	return Equalizer{Enabled: false, Gains: make([]float64, len(eqFrequencies))}
}

func normalizeEqualizer(e Equalizer) Equalizer {
	gains := make([]float64, len(eqFrequencies))
	for i := range gains {
		if i < len(e.Gains) {
			gains[i] = clampGain(e.Gains[i])
		}
	}
	return Equalizer{Enabled: e.Enabled, Gains: gains}
}

func clampGain(g float64) float64 {
	if math.IsNaN(g) {
		return 0
	}
	g = math.Round(g*10) / 10
	return math.Max(eqMinGain, math.Min(eqMaxGain, g))
}

func validateEqualizer(e Equalizer) error {
	if len(e.Gains) != len(eqFrequencies) {
		return fmt.Errorf("jumlah band harus %d", len(eqFrequencies))
	}
	for _, g := range e.Gains {
		if math.IsNaN(g) || g < eqMinGain || g > eqMaxGain {
			return fmt.Errorf("gain harus antara %.0f dan %.0f dB", eqMinGain, eqMaxGain)
		}
	}
	return nil
}

func equalizerFilters(e Equalizer) []string {
	if !e.Enabled {
		return nil
	}
	e = normalizeEqualizer(e)
	last := len(eqFrequencies) - 1
	var filters []string
	boosted := false
	for i, g := range e.Gains {
		if g == 0 {
			continue
		}
		if g > 0 {
			boosted = true
		}
		f := eqFrequencies[i]
		switch i {
		case 0:
			filters = append(filters, fmt.Sprintf("lowshelf=f=%d:g=%.1f", f, g))
		case last:
			filters = append(filters, fmt.Sprintf("highshelf=f=%d:g=%.1f", f, g))
		default:
			filters = append(filters, fmt.Sprintf("equalizer=f=%d:t=o:w=2:g=%.1f", f, g))
		}
	}
	if boosted {
		filters = append(filters, "alimiter=limit=0.95")
	}
	return filters
}

func audioFilterChain(cfg Config) string {
	parts := equalizerFilters(cfg.Equalizer)
	parts = append(parts, fmt.Sprintf("volume=%.2f", cfg.Volume))
	return strings.Join(parts, ",")
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
