package main

import (
	"fmt"
	"math"
	"strings"
)

const (
	eqMinGain = -12.0
	eqMaxGain = 12.0
	eqPeakQ   = 2.0 / 3.0
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
			filters = append(filters, fmt.Sprintf("lowshelf=f=%d:t=s:w=1:g=%.1f", f, g))
		case last:
			filters = append(filters, fmt.Sprintf("highshelf=f=%d:t=s:w=1:g=%.1f", f, g))
		default:
			filters = append(filters, fmt.Sprintf("equalizer=f=%d:t=q:w=%.4f:g=%.1f", f, eqPeakQ, g))
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
