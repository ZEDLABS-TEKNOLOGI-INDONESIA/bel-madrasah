package main

import (
	"net/http"
	"os"
	"strings"
	"testing"
)

func TestEqualizerFilters(t *testing.T) {
	if f := equalizerFilters(Equalizer{Enabled: false, Gains: []float64{6, 0, 0, 0, 0}}); f != nil {
		t.Fatalf("disabled equalizer produced %v", f)
	}
	if f := equalizerFilters(Equalizer{Enabled: true, Gains: []float64{0, 0, 0, 0, 0}}); len(f) != 0 {
		t.Fatalf("flat equalizer produced %v", f)
	}
	got := strings.Join(equalizerFilters(Equalizer{Enabled: true, Gains: []float64{4, 0, -3, 0, 2}}), ",")
	want := "lowshelf=f=60:t=s:w=1:g=4.0,equalizer=f=1000:t=q:w=0.6667:g=-3.0,highshelf=f=12000:t=s:w=1:g=2.0,alimiter=limit=0.95"
	if got != want {
		t.Fatalf("got %s\nwant %s", got, want)
	}
	cut := strings.Join(equalizerFilters(Equalizer{Enabled: true, Gains: []float64{-4, 0, 0, 0, 0}}), ",")
	if strings.Contains(cut, "alimiter") {
		t.Fatal("limiter should only be added when a band is boosted")
	}
	chain := audioFilterChain(Config{Volume: 0.5, Equalizer: Equalizer{Enabled: true, Gains: []float64{0, 3, 0, 0, 0}}})
	if !strings.HasSuffix(chain, ",volume=0.50") || !strings.HasPrefix(chain, "equalizer=f=250") {
		t.Fatalf("chain %s", chain)
	}
}

func TestEqualizerNormalizeAndValidate(t *testing.T) {
	n := normalizeEqualizer(Equalizer{Gains: []float64{20, -30}})
	if len(n.Gains) != len(eqFrequencies) || n.Gains[0] != eqMaxGain || n.Gains[1] != eqMinGain || n.Gains[4] != 0 {
		t.Fatalf("normalize %v", n.Gains)
	}
	if validateEqualizer(Equalizer{Gains: []float64{0, 0}}) == nil {
		t.Fatal("short band list accepted")
	}
	if validateEqualizer(Equalizer{Gains: []float64{0, 0, 13, 0, 0}}) == nil {
		t.Fatal("out of range gain accepted")
	}
}

func TestEqualizerEndpointAndConfigPreserve(t *testing.T) {
	setupTestDir(t)
	rec := postJSON(t, handleEqualizer, Equalizer{Enabled: true, Gains: []float64{3, 0, 0, 0, -2}})
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if rec := postJSON(t, handleConfig, map[string]any{"mode": "reguler", "volume": 1}); rec.Code != http.StatusOK {
		t.Fatalf("config status %d", rec.Code)
	}
	cfg, _ := loadConfig()
	if !cfg.Equalizer.Enabled || cfg.Equalizer.Gains[0] != 3 || cfg.Equalizer.Gains[4] != -2 {
		t.Fatalf("equalizer lost after config save: %+v", cfg.Equalizer)
	}
}

func TestVolumeZeroIsKept(t *testing.T) {
	setupTestDir(t)
	if rec := postJSON(t, handleVolume, map[string]float64{"volume": 0}); rec.Code != http.StatusOK {
		t.Fatalf("status %d", rec.Code)
	}
	cfg, _ := loadConfig()
	if cfg.Volume != 0 {
		t.Fatalf("volume 0 dibaca sebagai %v", cfg.Volume)
	}
	if err := os.WriteFile(configFile, []byte(`{"mode":"reguler"}`), 0644); err != nil {
		t.Fatal(err)
	}
	cfg, _ = loadConfig()
	if cfg.Volume != defaultConfig().Volume {
		t.Fatalf("volume tanpa field harus bawaan, dapat %v", cfg.Volume)
	}
}
