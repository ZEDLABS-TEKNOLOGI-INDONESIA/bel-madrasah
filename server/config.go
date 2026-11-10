package main

import (
	"encoding/json"
	"os"
	"sync"
	"time"
)

type Config struct {
	Mode           string              `json:"mode"`
	ManualOverride bool                `json:"manual_override"`
	RamadhanStart  string              `json:"ramadhan_start"`
	RamadhanEnd    string              `json:"ramadhan_end"`
	PTSStart       string              `json:"pts_start"`
	PTSEnd         string              `json:"pts_end"`
	PASStart       string              `json:"pas_start"`
	PASEnd         string              `json:"pas_end"`
	PesantrenStart string              `json:"pesantren_start"`
	PesantrenEnd   string              `json:"pesantren_end"`
	LiburDates     []LiburDate         `json:"libur_dates"`
	Volume         float64             `json:"volume"`
	DisabledDays   map[string][]string `json:"disabled_days"`
	Equalizer      Equalizer           `json:"equalizer"`
}

type LiburDate struct {
	Date       string `json:"date"`
	Keterangan string `json:"keterangan"`
}

var AllHari = []string{"Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"}

var AllModes = []string{"reguler", "ramadhan", "pts", "pas", "pesantren", "lainnya"}

var validModes = func() map[string]bool {
	m := make(map[string]bool, len(AllModes))
	for _, mode := range AllModes {
		m[mode] = true
	}
	return m
}()

var configMu sync.RWMutex

func defaultConfig() Config {
	return Config{
		Mode:         "reguler",
		Volume:       0.85,
		LiburDates:   []LiburDate{},
		DisabledDays: map[string][]string{},
		Equalizer:    defaultEqualizer(),
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
		c.LiburDates = []LiburDate{}
	}
	if c.DisabledDays == nil {
		c.DisabledDays = map[string][]string{}
	}
	if c.Volume == 0 {
		c.Volume = 0.85
	}
	c.Equalizer = normalizeEqualizer(c.Equalizer)
	return c, nil
}

func saveConfig(c Config) error {
	configMu.Lock()
	defer configMu.Unlock()
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return atomicWrite(configFile, data, 0644)
}

func resolveMode(c Config) string {
	if c.ManualOverride {
		return c.Mode
	}
	today := time.Now().Format("2006-01-02")
	if c.PTSStart != "" && c.PTSEnd != "" && today >= c.PTSStart && today <= c.PTSEnd {
		return "pts"
	}
	if c.PASStart != "" && c.PASEnd != "" && today >= c.PASStart && today <= c.PASEnd {
		return "pas"
	}
	if c.PesantrenStart != "" && c.PesantrenEnd != "" && today >= c.PesantrenStart && today <= c.PesantrenEnd {
		return "pesantren"
	}
	if c.RamadhanStart != "" && c.RamadhanEnd != "" && today >= c.RamadhanStart && today <= c.RamadhanEnd {
		return "ramadhan"
	}
	return "reguler"
}

func isLibur(c Config) bool {
	today := time.Now().Format("2006-01-02")
	for _, d := range c.LiburDates {
		if d.Date == today {
			return true
		}
	}
	return false
}

func isDayDisabled(c Config, mode, hari string) bool {
	days, ok := c.DisabledDays[mode]
	if !ok {
		return false
	}
	for _, d := range days {
		if d == hari {
			return true
		}
	}
	return false
}
